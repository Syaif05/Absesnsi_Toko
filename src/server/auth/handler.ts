import { createAuthHandler } from './http';
import { authRuntime } from './runtime';
export const handleAuth=createAuthHandler(authRuntime);
