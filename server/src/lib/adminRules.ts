type RoleValue = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

// BR-24: would this change leave the system without any active Administrator?
// `otherActiveAdministrators` counts the active administrators other than the target.
export function leavesNoActiveAdministrator(
    target: { role: RoleValue; isActive: boolean },
    change: { role?: RoleValue; isActive?: boolean },
    otherActiveAdministrators: number
): boolean {
    const isActiveAdministratorNow = target.role === "ADMINISTRATOR" && target.isActive;
    if (!isActiveAdministratorNow) return false; // nothing is being taken away

    const role = change.role ?? target.role;
    const isActive = change.isActive ?? target.isActive;
    const staysActiveAdministrator = role === "ADMINISTRATOR" && isActive;

    return !staysActiveAdministrator && otherActiveAdministrators === 0;
}