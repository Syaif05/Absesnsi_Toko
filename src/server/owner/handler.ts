import { authRuntime } from "../auth/runtime";
import { OwnerService } from "./service";
import { createOwnerHandler } from "./http";
export const handleOwner = createOwnerHandler(() => {
  const { service, origin } = authRuntime();
  return { owner: new OwnerService(service), origin };
});
