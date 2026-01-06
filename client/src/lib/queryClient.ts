import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Maintenance mode event system
export interface MaintenanceInfo {
  isInMaintenance: boolean;
  message: string;
  windowStart: string;
  windowEnd: string;
  resumesAt: string | null;
  remainingMinutes: number | null;
}

type MaintenanceListener = (info: MaintenanceInfo) => void;
const maintenanceListeners: Set<MaintenanceListener> = new Set();

export function onMaintenanceChange(listener: MaintenanceListener) {
  maintenanceListeners.add(listener);
  return () => maintenanceListeners.delete(listener);
}

function notifyMaintenance(info: MaintenanceInfo) {
  maintenanceListeners.forEach(listener => listener(info));
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Check for maintenance mode response (503)
    if (res.status === 503) {
      try {
        const data = await res.clone().json();
        if (data.error === "maintenance") {
          notifyMaintenance({
            isInMaintenance: true,
            message: data.message,
            windowStart: data.details?.windowStart || "13:00",
            windowEnd: data.details?.windowEnd || "14:00",
            resumesAt: data.details?.resumesAt || null,
            remainingMinutes: data.details?.remainingMinutes || null,
          });
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let url = queryKey[0] as string;
    
    if (queryKey.length > 1 && typeof queryKey[1] === 'object' && queryKey[1] !== null) {
      const params = new URLSearchParams();
      const paramsObj = queryKey[1] as Record<string, string>;
      
      for (const [key, value] of Object.entries(paramsObj)) {
        if (value !== undefined && value !== null && value !== "todos") {
          params.append(key, value);
        }
      }
      
      const queryString = params.toString();
      if (queryString) {
        url = `${url}?${queryString}`;
      }
    } else {
      url = queryKey.join("/") as string;
    }

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
