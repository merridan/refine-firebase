import { FirebaseApp } from "@firebase/app";
import { AuthProvider } from "@refinedev/core";
import { Auth, inMemoryPersistence, browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, getAuth, getIdTokenResult, ParsedToken, RecaptchaParameters, RecaptchaVerifier, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateEmail, updatePassword, updateProfile, User as FirebaseUser } from "firebase/auth";
import { IAuthCallbacks, ILoginArgs, IRegisterArgs, IUser } from "./interfaces";
import { detectPlatform } from "./helpers/detectPlatform";

export class FirebaseAuth {
    auth: Auth;

    constructor (
        private readonly authActions?: IAuthCallbacks,
        firebaseApp?: FirebaseApp,
        auth?: Auth
    ) {
        this.auth = auth || getAuth(firebaseApp);
        this.auth.useDeviceLanguage();

        this.getAuthProvider = this.getAuthProvider.bind(this);
        this.handleLogIn = this.handleLogIn.bind(this);
        this.handleRegister = this.handleRegister.bind(this);
        this.handleLogOut = this.handleLogOut.bind(this);
        this.handleResetPassword = this.handleResetPassword.bind(this);
        this.onUpdateUserData = this.onUpdateUserData.bind(this);
        this.getUserIdentity = this.getUserIdentity.bind(this);
        this.handleCheckAuth = this.handleCheckAuth.bind(this);
        this.createRecaptcha = this.createRecaptcha.bind(this);
        this.getPermissions = this.getPermissions.bind(this);
    }

    public async handleLogOut() {
        try {
            await signOut(this.auth);
            await this.authActions?.onLogout?.(this.auth);
            return { success: true };
        } catch (error: any) {
            return { success: false, error };
        }
    }

    public async handleRegister(args: IRegisterArgs) {
        try {
            const { email, password, displayName } = args;

            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            await sendEmailVerification(userCredential.user);
            if (userCredential.user) {
                if (displayName) {
                    await updateProfile(userCredential.user, { displayName });
                }
                this.authActions?.onRegister?.(userCredential.user);
            }
            return { success: true };
        } catch (error: any) {
            return { success: false, error };
        }
    }

    public async handleLogIn({ email, password, remember }: ILoginArgs) {
        try {
            if (this.auth) {
                let persistance = browserSessionPersistence;
                if (detectPlatform() === "react-native") {
                    persistance = inMemoryPersistence;
                } else if (remember) {
                    persistance = browserLocalPersistence;
                }
                await this.auth.setPersistence(persistance);

                const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
                const userToken = await userCredential?.user?.getIdToken?.();
                if (userToken) {
                    this.authActions?.onLogin?.(userCredential.user);
                    return { success: true };
                } else {
                    return { success: false, error: new Error("User is not found") };
                }
            } else {
                return { success: false, error: new Error("User is not found") };
            }
        } catch (error: any) {
            return { success: false, error };
        }
    }

    public async handleResetPassword(email: string) {
        try {
            await sendPasswordResetEmail(this.auth, email);
            return { success: true };
        } catch (error: any) {
            return { success: false, error };
        }
    }

    public async onUpdateUserData(args: IRegisterArgs) {
        try {
            if (this.auth?.currentUser) {
                const { displayName, email, password } = args;
                if (password) {
                    await updatePassword(this.auth.currentUser, password);
                }

                if (email && this.auth.currentUser.email !== email) {
                    await updateEmail(this.auth.currentUser, email);
                }

                if (displayName && this.auth.currentUser.displayName !== displayName) {
                    await updateProfile(this.auth.currentUser, { displayName: displayName });
                }
                return { success: true };
            }
            return { success: false, error: new Error("User is not found") };
        } catch (error: any) {
            return { success: false, error };
        }
    }

    private async getUserIdentity(): Promise<IUser> {
        const user = this.auth?.currentUser;
        return {
            ...this.auth.currentUser,
            email: user?.email || "",
            name: user?.displayName || ""
        };
    }

    private getFirebaseUser(): Promise<FirebaseUser> {
        return new Promise<FirebaseUser>((resolve, reject) => {
            const unsubscribe = this.auth?.onAuthStateChanged(user => {
                unsubscribe();
                resolve(user as FirebaseUser | PromiseLike<FirebaseUser>);
            }, reject);
        });
    }

    private async handleCheckAuth() {
        const user = await this.getFirebaseUser();
        if (user) {
            return { authenticated: true };
        } else {
            return { authenticated: false, error: new Error("User is not found"), logout: true };
        }
    }

    public async getPermissions(): Promise<ParsedToken> {
        if (this.auth?.currentUser) {
            const idTokenResult = await getIdTokenResult(this.auth.currentUser);
            return idTokenResult?.claims;
        } else {
            return Promise.reject(new Error("User is not found"));
        }
    }

    public createRecaptcha(containerOrId: string | HTMLDivElement, parameters?: RecaptchaParameters) {
        return new RecaptchaVerifier(containerOrId, parameters, this.auth);
    }

    public getAuthProvider(): AuthProvider {
        return {
            login: this.handleLogIn,
            logout: this.handleLogOut,
            check: this.handleCheckAuth,
            onError: () => Promise.resolve({}),
            getPermissions: this.getPermissions,
            getIdentity: this.getUserIdentity,
            register: this.handleRegister,
            forgotPassword: this.handleResetPassword,
            updatePassword: this.onUpdateUserData,
        };
    }
}
