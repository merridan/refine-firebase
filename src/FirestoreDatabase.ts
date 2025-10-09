import { Firestore, getDocs, getFirestore, collection, addDoc, doc, getDoc, updateDoc, deleteDoc, where, query, CollectionReference, DocumentData, Query, orderBy, setDoc } from "firebase/firestore";
import { ICreateData, IDeleteData, IDeleteManyData, IGetList, IGetMany, IGetOne, IDatabaseOptions, IUpdateData, IUpdateManyData, CrudOperators, ICustomMethod } from "./interfaces";
import { BaseDatabase } from "./Database";


export class FirestoreDatabase extends BaseDatabase {
    database: Firestore;

    constructor (options?: IDatabaseOptions, database?: Firestore) {
        super(options);
        this.database = database || getFirestore(options?.firebaseApp);

        this.getCollectionRef = this.getCollectionRef.bind(this);
        this.getFilterQuery = this.getFilterQuery.bind(this);
    }


    getCollectionRef(resource: string) {
        return collection(this.database, resource);
    }

    getDocRef(resource: string, id: string) {
        return doc(this.database, resource, id);
    }

    getFilterQuery({ resource, sort, filters }: IGetList): (CollectionReference<DocumentData> | Query<DocumentData>) {
        const ref = this.getCollectionRef(resource);
        let queryFilter = filters?.map(filter => {
            const operator = getFilterOperator(filter.operator);
            return where(filter.field, operator, filter.value);
        });
        let querySorter = sort?.map(sorter => orderBy(sorter.field, sorter.order));

        if (queryFilter?.length && querySorter?.length) {
            return query(ref, ...queryFilter, ...querySorter);
        } else if (queryFilter?.length) {
            return query(ref, ...queryFilter);
        } else if (querySorter?.length) {
            return query(ref, ...querySorter);
        }
        else {
            return ref;
        }
    }

    async createData<TVariables = {}>(args: ICreateData<TVariables>): Promise<any> {
        try {
            const ref = this.getCollectionRef(args.resource);
            const payload = this.requestPayloadFactory(args.resource, args.variables);

            const docRef = await addDoc(ref, payload);

            let data = {
                id: docRef.id,
                ...payload
            };

            return { data };
        } catch (error) {
            Promise.reject(error);
        }
    }

    async createManyData<TVariables = {}>(args: ICreateData<TVariables>): Promise<any> {
        try {
            var data = await this.createData(args);

            return { data };
        } catch (error) {
            Promise.reject(error);
        }
    }

    async deleteData(args: IDeleteData): Promise<any> {
        try {
            const ref = this.getDocRef(args.resource, args.id);

            await deleteDoc(ref);
        } catch (error) {
            Promise.reject(error);
        }
    }

    async deleteManyData(args: IDeleteManyData): Promise<any> {
        try {
            args.ids.forEach(async id => {
                this.deleteData({ resource: args.resource, id });
            });
        } catch (error) {
            Promise.reject(error);
        }
    }

    async getList(args: IGetList): Promise<any> {
        try {
            const ref = this.getFilterQuery(args);
            let data: any[] = [];
            const current = args.pagination?.current ?? 1;
            const limit = args.pagination?.pageSize || 10;

            const querySnapshot = await getDocs(ref);

            querySnapshot.forEach(document => {
                data.push(this.responsePayloadFactory(args.resource, {
                    id: document.id,
                    ...document.data()
                }));
            });
            return { data };

        } catch (error) {
            Promise.reject(error);
        }
    }

    async getMany(args: IGetMany): Promise<any> {
        try {
            const ref = this.getCollectionRef(args.resource);
            let data: any[] = [];

            const querySnapshot = await getDocs(ref);

            querySnapshot.forEach(document => {
                if (args.ids.includes(document.id)) {
                    data.push(this.responsePayloadFactory(args.resource, {
                        id: document.id,
                        ...document.data()
                    }));
                }
            });
            return { data };
        } catch (error) {
            Promise.reject(error);
        }
    }

    async getOne(args: IGetOne): Promise<any> {
        try {
            if (args.resource && args.id) {
                const docRef = this.getDocRef(args.resource, args.id);

                const docSnap = await getDoc(docRef);

                const data = this.responsePayloadFactory(args.resource, { ...docSnap.data(), id: docSnap.id });

                return { data };
            }

        } catch (error: any) {
            Promise.reject(error);
        }
    }

    async updateData<TVariables = {}>(args: IUpdateData<TVariables>): Promise<any> {
        try {
            if (args.id && args.resource) {
                var ref = this.getDocRef(args.resource, args.id);
                await updateDoc(ref, this.requestPayloadFactory(args.resource, args.variables));
            }

            return { data: args.variables };
        } catch (error) {
            Promise.reject(error);
        }
    }
    async updateManyData<TVariables = {}>(args: IUpdateManyData<TVariables>): Promise<any> {
        try {
            args.ids.forEach(async id => {
                var ref = this.getDocRef(args.resource, id);
                await updateDoc(ref, this.requestPayloadFactory(args.resource, args.variables));
            });

        } catch (error) {
            Promise.reject(error);
        }
    }

    async custom<TData = any, TQuery = unknown, TPayload = unknown>(args: ICustomMethod): Promise<any> {
        try {
            const { url, method, payload, metaData } = args;
            
            // Parse URL to extract resource and optional document ID
            // Expected formats: "resource" or "resource/id"
            const parts = url.split('/');
            const resource = parts[0];
            const id = parts[1];

            // For setDoc operations, we need both resource and id
            if (method === "post" || method === "put" || method === "patch") {
                if (id) {
                    // Use setDoc to create or update document with specific ID
                    const ref = this.getDocRef(resource, id);
                    const processedPayload = this.requestPayloadFactory(resource, payload);
                    
                    // Use merge option for patch/put to allow partial updates
                    if (method === "patch" || method === "put") {
                        await setDoc(ref, processedPayload, { merge: true });
                    } else {
                        // For post, overwrite the document completely
                        await setDoc(ref, processedPayload);
                    }
                    
                    const data = this.responsePayloadFactory(resource, { id, ...processedPayload });
                    return { data };
                } else {
                    // If no ID provided, fall back to addDoc
                    const ref = this.getCollectionRef(resource);
                    const processedPayload = this.requestPayloadFactory(resource, payload);
                    const docRef = await addDoc(ref, processedPayload);
                    
                    const data = this.responsePayloadFactory(resource, { id: docRef.id, ...processedPayload });
                    return { data };
                }
            } else if (method === "get") {
                if (id) {
                    // Get single document
                    const docRef = this.getDocRef(resource, id);
                    const docSnap = await getDoc(docRef);
                    
                    if (docSnap.exists()) {
                        const data = this.responsePayloadFactory(resource, { id: docSnap.id, ...docSnap.data() });
                        return { data };
                    } else {
                        return Promise.reject(new Error("Document not found"));
                    }
                } else {
                    // Get list of documents
                    const ref = this.getCollectionRef(resource);
                    const querySnapshot = await getDocs(ref);
                    let data: any[] = [];
                    
                    querySnapshot.forEach(document => {
                        data.push(this.responsePayloadFactory(resource, {
                            id: document.id,
                            ...document.data()
                        }));
                    });
                    return { data };
                }
            } else if (method === "delete") {
                if (id) {
                    // Delete single document
                    const ref = this.getDocRef(resource, id);
                    await deleteDoc(ref);
                    return { data: { id } };
                } else {
                    return Promise.reject(new Error("Document ID required for delete operation"));
                }
            } else {
                return Promise.reject(new Error(`Unsupported method: ${method}`));
            }
        } catch (error) {
            return Promise.reject(error);
        }
    }
}

function getFilterOperator(operator: CrudOperators) {
    switch (operator) {
        case "lt":
            return "<";
        case "lte":
            return "<=";

        case "gt":
            return ">";
        case "gte":
            return ">=";

        case "eq":
            return "==";
        case "ne":
            return "!=";

        case "nin":
            return "not-in";

        case "in":
        default:
            return "in";
    }
}
