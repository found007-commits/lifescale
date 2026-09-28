// Read requests may be replayed once after a transport failure. Never replay a
// write: a lost response does not prove the server did not commit the operation.
export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
  const method = (init?.method || request?.method || "GET").toUpperCase();
  const signal = init?.signal || request?.signal;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (signal?.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
      if (attempt === 0 && ["GET", "HEAD"].includes(method) && error instanceof TypeError) {
        await new Promise(resolve => setTimeout(resolve, 400));
        if (signal?.aborted) throw error;
        continue;
      }
      if (error instanceof TypeError) throw new Error("网络连接暂时中断，请重试；若仍无法连接，请切换 Wi-Fi 或移动网络。 / Connection interrupted. Please retry or switch networks.");
      throw error;
    }
  }
}
