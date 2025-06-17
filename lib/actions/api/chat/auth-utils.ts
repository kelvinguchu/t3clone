import { auth } from "@clerk/nextjs/server";

// Retrieve Convex-compatible token (template "convex") for the current user
export async function getConvexFetchOptions() {
  const clerk = await auth();

  if (!clerk.userId) return { userId: null, fetchOptions: undefined };

  const token = await clerk.getToken({ template: "convex" });

  return { userId: clerk.userId, fetchOptions: token ? { token } : undefined };
}
