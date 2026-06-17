const BASE_URL =
  process.env.NEXT_PUBLIC_STORAGE_SERVER_URL || "http://localhost:5003";

// Helper to get a Clerk session token from the browser
async function getToken(): Promise<string> {
  // Clerk exposes getToken via useAuth hook — but for a plain module,
  // we read it from a shared store. See Step 3 for the hook approach.
  throw new Error(
    "Use the useStorageApi hook instead of calling this directly.",
  );
}

// We export factory functions that accept a token string
// so they can be called from components with the Clerk token.

export async function apiFetch(
  token: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

// --- Files ---

export async function listFiles(
  token: string,
  parentId?: string | null,
  trashed = false,
  orgIds: string[] = [], // optional org IDs to include org files
  search?: string, // optional name search (server-side, cross-folder)
) {
  const params = new URLSearchParams();
  if (parentId) params.set("parentId", parentId);
  if (trashed) params.set("trashed", "true");
  if (orgIds.length > 0) params.set("orgIds", orgIds.join(","));
  if (search) params.set("search", search);
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await apiFetch(token, `/api/files${query}`);
  if (!res.ok) throw new Error("Failed to fetch files");
  return res.json(); // Array of File objects
}

export async function createFolder(
  token: string,
  name: string,
  parentId?: string | null,
) {
  const res = await apiFetch(token, "/api/files/folder", {
    method: "POST",
    body: JSON.stringify({ name, parentId }),
  });
  if (!res.ok) throw new Error("Failed to create folder");
  return res.json();
}

export async function renameItem(token: string, id: string, name: string) {
  const res = await apiFetch(token, `/api/files/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to rename item");
  return res.json();
}

export async function trashItem(
  token: string,
  id: string,
  orgIds: string[] = [],
) {
  const query = orgIds.length > 0 ? `?orgIds=${orgIds.join(",")}` : "";
  const res = await apiFetch(token, `/api/files/${id}${query}`, {
    method: "PATCH",
    body: JSON.stringify({ isTrashed: true }),
  });
  if (!res.ok) throw new Error("Failed to trash item");
  return res.json();
}

export async function deleteItem(
  token: string,
  id: string,
  orgIds: string[] = [],
) {
  const query = orgIds.length > 0 ? `?orgIds=${orgIds.join(",")}` : "";
  const res = await apiFetch(token, `/api/files/${id}${query}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete item");
}

// --- Upload ---

export async function uploadFile(
  token: string,
  file: File,
  parentId?: string | null,
  mode?: "replace" | "keep",
) {
  // Step 1: Get a pre-signed upload URL
  const uploadRes = await apiFetch(token, "/api/storage/upload", {
    method: "POST",
    body: JSON.stringify({
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      parentId,
      ...(mode ? { mode } : {}),
    }),
  });
  if (!uploadRes.ok) throw new Error("Failed to initiate upload");
  const { uploadUrl, fileId } = await uploadRes.json();

  // Step 2: PUT the raw file to Azure Blob Storage via the signed URL
  await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": file.type,
    },
    body: file,
  });

  // Step 3: Tell the server the upload is complete
  const finalizeRes = await apiFetch(token, "/api/storage/finalize", {
    method: "POST",
    body: JSON.stringify({ fileId }),
  });
  if (!finalizeRes.ok) throw new Error("Failed to finalize upload");
  return finalizeRes.json();
}

// --- Download ---

export async function getDownloadUrl(
  token: string,
  fileId: string,
  orgIds: string[] = [],
): Promise<string> {
  const query = orgIds.length > 0 ? `?orgIds=${orgIds.join(",")}` : "";
  const res = await apiFetch(token, `/api/storage/download/${fileId}${query}`);
  if (!res.ok) throw new Error("Failed to get download URL");
  const { downloadUrl: url } = await res.json();
  return url;
}

// --- Trash ---

export async function emptyTrash(token: string, orgIds: string[] = []) {
  const query = orgIds.length > 0 ? `?orgIds=${orgIds.join(",")}` : "";
  const res = await apiFetch(token, `/api/trash${query}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to empty trash");
}
export async function restoreItem(
  token: string,
  id: string,
  orgIds: string[] = [],
) {
  const query = orgIds.length > 0 ? `?orgIds=${orgIds.join(",")}` : "";
  const res = await apiFetch(token, `/api/files/${id}${query}`, {
    method: "PATCH",
    body: JSON.stringify({ isTrashed: false }),
  });
  if (!res.ok) throw new Error("Failed to restore item");
  return res.json();
}

export async function getViewUrl(
  token: string,
  fileId: string,
  orgIds: string[] = [],
): Promise<string> {
  const query = orgIds.length > 0 ? `?orgIds=${orgIds.join(",")}` : "";
  const res = await apiFetch(token, `/api/storage/view/${fileId}${query}`);
  if (!res.ok) throw new Error("Failed to get view URL");
  const { viewUrl } = await res.json();
  return viewUrl;
}

export async function getUsage(token: string): Promise<{
  usedBytes: number;
  limitBytes: number;
  percentage: number;
}> {
  const res = await apiFetch(token, "/api/files/usage");
  if (!res.ok) throw new Error("Failed to get storage usage");
  return res.json();
}

export async function moveItem(
  token: string,
  id: string,
  newParentId: string | null,
) {
  const res = await apiFetch(token, `/api/files/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ parentId: newParentId }),
  });
  if (!res.ok) throw new Error("Failed to move item");
  return res.json();
}

export async function copyItem(
  token: string,
  id: string,
  newParentId: string | null,
) {
  const res = await apiFetch(token, `/api/files/${id}/copy`, {
    method: "POST",
    body: JSON.stringify({ parentId: newParentId }),
  });
  if (!res.ok) throw new Error("Failed to copy item");
  return res.json();
}

export async function ensureOrgFolder(
  token: string,
  orgId: string,
  orgName: string,
): Promise<{
  rootFolderId: string;
  orgFolderId: string;
  productImagesFolderId: string;
}> {
  const res = await apiFetch(token, "/api/files/org-folder", {
    method: "POST",
    body: JSON.stringify({ orgId, orgName }),
  });
  if (!res.ok) throw new Error("Failed to ensure org folder");
  return res.json();
}

export async function uploadInventoryImage(
  token: string,
  file: File,
  orgId: string,
  sku: string,
  parentId: string, // the org-name folder's DB id (from ensureOrgFolder)
) {
  // 1. Register the file and get a pre-signed Azure SAS URL
  const uploadRes = await apiFetch(token, "/api/storage/upload", {
    method: "POST",
    body: JSON.stringify({
      name: file.name,
      type: file.type || "image/jpeg",
      size: file.size,
      mimeType: file.type,
      parentId,
      orgId,
      sku,
    }),
  });
  if (!uploadRes.ok) throw new Error("Failed to initiate inventory upload");
  const { uploadUrl, fileId } = await uploadRes.json();

  // 2. PUT directly to Azure Blob Storage
  await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "x-ms-blob-type": "BlockBlob",
      "Content-Type": file.type,
    },
    body: file,
  });

  // 3. Finalize with the storage server
  const finalizeRes = await apiFetch(token, "/api/storage/finalize", {
    method: "POST",
    body: JSON.stringify({ fileId }),
  });
  if (!finalizeRes.ok) throw new Error("Failed to finalize inventory upload");
  return finalizeRes.json(); // { success: true }
}
