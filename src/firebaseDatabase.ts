import { Database, get, getDatabase, ref, remove, set } from "firebase/database";
import { ICreateData, IDeleteData, IDeleteManyData, IGetList, IGetMany, IGetOne, IDatabaseOptions, IUpdateData, IUpdateManyData, ICustomMethod } from "./interfaces";
import { BaseDatabase } from "./Database";

import { v4 as uuidv4 } from 'uuid';


export class FirebaseDatabase extends BaseDatabase {
    database: Database;

    constructor (options?: IDatabaseOptions, database?: Database) {
        super(options);
        this.database = database || getDatabase(options?.firebaseApp);
        this.getRef = this.getRef.bind(this);
    }

    getRef(url: string) {
        return ref(this.database, url);
    }

    async createData<TVariables = {}>(args: ICreateData<TVariables>): Promise<any> {
        try {
            const uuid = uuidv4();
            const databaseRef = this.getRef(`${args.resource}/${uuid}`);
            const payload = {
                ...args.variables,
                id: uuid,
            };

            await set(databaseRef, this.requestPayloadFactory(args.resource, payload));

            return { data: payload };
        } catch (error) {
            Promise.reject(error);
        }
    }

    async createManyData<TVariables = {}>(args: ICreateData<TVariables>): Promise<any> {
        try {
            const data = await this.createData(args);

            return { data };
        } catch (error) {
            Promise.reject(error);
        }
    }

    async deleteData(args: IDeleteData): Promise<any> {
        try {
            const databaseRef = this.getRef(`${args.resource}/${args.id}`);
            await remove(databaseRef);
        } catch (error) {
            Promise.reject(error);
        }
    }

    async deleteManyData(args: IDeleteManyData): Promise<any> {
        try {
            args.ids.forEach(async id => {
                await this.deleteData({ resource: args.resource, id });
            });
        } catch (error) {
            Promise.reject(error);
        }
    }

    async getList(args: IGetList): Promise<any> {
        try {
            const databaseRef = this.getRef(args.resource);

            let snapshot = await get(databaseRef);

            if (snapshot?.exists()) {
                let data = Object.values(snapshot.val());
                data = data.map(item => this.responsePayloadFactory(args.resource, item));
                return { data };
            } else {
                Promise.reject();
            }
        } catch (error) {
            Promise.reject(error);
        }
    }

    async getMany(args: IGetMany): Promise<any> {
        try {
            let { resource, ids } = args;
            const databaseRef = this.getRef(resource);

            let snapshot = await get(databaseRef);

            if (snapshot?.exists()) {
                let data = ids.filter((item, i) => ids.indexOf(item) === i)?.map(id => snapshot.val()?.[id]);
                data = this.responsePayloadFactory(args.resource, data);

                return { data };
            } else {
                Promise.reject();
            }

        } catch (error) {
            Promise.reject(error);
        }
    }

    async getOne(args: IGetOne): Promise<any> {
        try {
            const databaseRef = this.getRef(args.resource);

            let snapshot = await get(databaseRef);

            if (snapshot?.exists()) {
                let data = this.responsePayloadFactory(args.resource, snapshot.val()?.[args.id]);

                return { data };
            } else {
                Promise.reject("");
            }
        } catch (error: any) {
            Promise.reject(error);
        }
    }

    async updateData<TVariables = {}>(args: IUpdateData<TVariables>): Promise<any> {
        try {
            const databaseRef = this.getRef(`${args.resource}/${args.id}`);

            await set(databaseRef, this.requestPayloadFactory(args.resource, args.variables));

            return { data: args.variables };
        } catch (error) {
            Promise.reject(error);
        }
    }
    async updateManyData<TVariables = {}>(args: IUpdateManyData<TVariables>): Promise<any> {
        try {
            let data: Array<any> = [];
            args.ids.forEach(async (id: string) => {
                const result = this.updateData({ resource: args.resource, variables: args.variables, id });
                data.push(result);
            });
            return { data };

        } catch (error) {
            Promise.reject(error);
        }
    }

    async custom<TData = any, TQuery = unknown, TPayload = unknown>(args: ICustomMethod): Promise<any> {
        try {
            const { url, method, payload } = args;
            
            // Parse URL to extract resource and optional document ID
            // Expected formats: "resource" or "resource/id"
            const parts = url.split('/');
            const resource = parts[0];
            const id = parts[1];

            // For set operations
            if (method === "post" || method === "put" || method === "patch") {
                if (id) {
                    // Use set to create or update document with specific ID
                    const databaseRef = this.getRef(`${resource}/${id}`);
                    const processedPayload = this.requestPayloadFactory(resource, payload);
                    
                    await set(databaseRef, processedPayload);
                    
                    const data = this.responsePayloadFactory(resource, { id, ...processedPayload });
                    return { data };
                } else {
                    // If no ID provided, generate a new one
                    const uuid = uuidv4();
                    const databaseRef = this.getRef(`${resource}/${uuid}`);
                    const processedPayload = {
                        ...payload,
                        id: uuid,
                    };
                    
                    await set(databaseRef, this.requestPayloadFactory(resource, processedPayload));
                    
                    const data = this.responsePayloadFactory(resource, processedPayload);
                    return { data };
                }
            } else if (method === "get") {
                if (id) {
                    // Get single document
                    const databaseRef = this.getRef(resource);
                    const snapshot = await get(databaseRef);
                    
                    if (snapshot?.exists()) {
                        const data = this.responsePayloadFactory(resource, snapshot.val()?.[id]);
                        return { data };
                    } else {
                        return Promise.reject(new Error("Document not found"));
                    }
                } else {
                    // Get list of documents
                    const databaseRef = this.getRef(resource);
                    const snapshot = await get(databaseRef);
                    
                    if (snapshot?.exists()) {
                        let data = Object.values(snapshot.val());
                        data = data.map(item => this.responsePayloadFactory(resource, item));
                        return { data };
                    } else {
                        return Promise.reject(new Error("Resource not found"));
                    }
                }
            } else if (method === "delete") {
                if (id) {
                    // Delete single document
                    const databaseRef = this.getRef(`${resource}/${id}`);
                    await remove(databaseRef);
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

