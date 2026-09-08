import { createContext, useContext, useState, ReactNode } from "react";
import { Requester } from "../api/requesters.js";

interface RequesterContextValue {
    requester: Requester | null;
    setRequester: (r: Requester) => void;
    clearRequester: () => void;
}

export const RequesterContext = createContext<RequesterContextValue | undefined>(undefined);

export function RequesterProvider({ children }: { children: ReactNode }) {
    const [requester, setRequesterState] = useState<Requester | null>(null);

    function setRequester(r: Requester) {
        setRequesterState(r);
    }

    function clearRequester() {
        setRequesterState(null);
    }

    return (
        <RequesterContext.Provider value={{ requester, setRequester, clearRequester }}>
            {children}
        </RequesterContext.Provider>
    );
}

export function useRequester(): RequesterContextValue {
    const ctx = useContext(RequesterContext);
    if (!ctx) {
        throw new Error("useRequester must be used within a RequesterProvider");
    }
    return ctx;
}
