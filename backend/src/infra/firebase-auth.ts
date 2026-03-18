import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { ResultAsync } from 'neverthrow';
import { errorBuilder, type InferError } from '../shared/error.js';
import { appLogger } from '../shared/logger.js';

const logger = appLogger('firebaseAuth');

export const FirebaseAuthError = errorBuilder('FirebaseAuthError');
export type FirebaseAuthError = InferError<typeof FirebaseAuthError>;

const initFirebase = (): void => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credentials) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require(credentials) as ServiceAccount;
    initializeApp({ credential: cert(serviceAccount) });
  } else if (projectId) {
    initializeApp({ projectId });
  } else {
    logger.warn('No Firebase credentials configured, using default');
    initializeApp();
  }
};

initFirebase();

const auth = getAuth();

export type AuthUser = {
  readonly uid: string;
  readonly email: string | undefined;
  readonly displayName: string | undefined;
  readonly photoURL: string | undefined;
};

const toAuthUser = (decoded: DecodedIdToken): AuthUser => ({
  uid: decoded.uid,
  email: decoded.email,
  displayName: decoded.name as string | undefined,
  photoURL: decoded.picture as string | undefined,
});

export const verifyFirebaseToken = (
  token: string,
): ResultAsync<AuthUser, FirebaseAuthError> =>
  ResultAsync.fromPromise(
    auth.verifyIdToken(token),
    FirebaseAuthError.handle,
  ).map(toAuthUser);
