export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    credentials: "include", // Rely on httpOnly cookies
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // If we get an unauthorized response, clear frontend state and redirect
    localStorage.removeItem("marketingUser");
    const path = window.location.pathname;
    if (path !== "/marketing/login" && !path.startsWith("/marketing/reset-password")) {
      window.location.href = "/marketing/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  return res;
}
