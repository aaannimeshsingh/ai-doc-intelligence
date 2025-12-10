// src/utils/authHelpers.js
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  // navigate to login page
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
