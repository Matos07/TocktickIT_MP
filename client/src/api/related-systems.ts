export interface RelatedSystem {
    id: number;
    name: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function fetchRelatedSystems(): Promise<RelatedSystem[]> {
    const res = await fetch(`${API_BASE}/api/related-systems`);
    if (!res.ok) throw new Error(`Failed to load related systems (HTTP ${res.status})`);
    return res.json();
}