import wretch from "wretch"

export const api = wretch("http://localhost:8000/api", {
  credentials: "include",
  mode: "cors",
})
