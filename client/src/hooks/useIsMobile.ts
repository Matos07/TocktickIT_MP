import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_PX = 768;

function computeIsMobile(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        // jsdom (test environment) doesn't implement matchMedia by default —
        // default to the desktop/table layout so existing tests keep working.
        return false;
    }
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 0.02}px)`).matches;
}

export function useIsMobile(): boolean {
    const [isMobile, setIsMobile] = useState(computeIsMobile);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 0.02}px)`);
        const handler = () => setIsMobile(mql.matches);
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, []);

    return isMobile;
}