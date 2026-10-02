const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function headers(extra: Record<string, string> = {}) {
  return {
    "Content-Type": "application/json",
    "x-demo-user-id": localStorage.getItem("ap2-demo-id") ?? "demo-principal",
    "x-demo-user-email": localStorage.getItem("ap2-demo-email") ?? "",
    "x-demo-user-roles": localStorage.getItem("ap2-demo-roles") ?? "PRINCIPAL",
    ...(localStorage.getItem("ap2-dept-scope")
      ? {
          "x-demo-dept-scope": localStorage.getItem("ap2-dept-scope") as string,
        }
      : {}),
    ...extra,
  };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: headers(init?.headers as never),
  });
  const body = (await res.json()) as {
    success: boolean;
    data: T;
    error?: { code: string };
  };
  if (!body.success) throw new Error(body.error?.code ?? `API ${res.status}`);
  return body.data;
}

export type Session = {
  _id: string;
  name: string;
  state: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
  startDate?: string;
  endDate?: string;
  createdAt: string;
};

export type Me = {
  id: string;
  email: string;
  roles: string[];
  departmentScope: string | null;
  permissions: string[];
};
