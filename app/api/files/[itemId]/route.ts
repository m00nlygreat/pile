import { getItemFile } from "@/lib/db";
import { storedFileResponse } from "@/lib/stored-file-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId: rawItemId } = await params;
  const itemId = decodeURIComponent(rawItemId);
  const file = getItemFile(itemId);
  return storedFileResponse(request, itemId, file);
}
