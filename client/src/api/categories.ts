export interface Category {
    id: number;
    name: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function fetchCategories(): Promise<Category[]> {
    const res = await fetch(`${API_BASE}/api/categories`);
    if (!res.ok) throw new Error(`Failed to load categories (HTTP ${res.status})`);
    return res.json();
}