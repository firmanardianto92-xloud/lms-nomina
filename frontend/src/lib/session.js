import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => api.get("/auth/me"), retry: false, staleTime: 60_000 });
}

export const ROLE_LABEL = { admin: "Admin L&D", counselor: "Counselor", counselee: "Member / Counselee" };
