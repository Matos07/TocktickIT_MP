import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriorityBadge, RoleBadge, StatusBadge } from "../../src/components/Badges.js";

describe("StatusBadge (STYLE-01)", () => {
    it.each([
        ["NEW", "New", "#EAF6EF"],
        ["OPEN", "Open", "#EAF6EF"],
        ["IN_PROGRESS", "In Progress", "#EAF6EF"],
        ["REOPENED", "Reopened", "#EAF6EF"],
        ["WAITING_FOR_REQUESTER", "Waiting for Requester", "#FCEFD8"],
        ["RESOLVED", "Resolved", "#0B7A46"],
        ["CLOSED", "Closed", "#0B7A46"],
        ["CANCELLED", "Cancelled", "#E9ECEA"],
    ])("%s renders the label %s on %s", (value, label, background) => {
        render(<StatusBadge value={value} />);
        expect(screen.getByText(label)).toHaveStyle(`background-color: ${background}`);
    });
});

describe("PriorityBadge (STYLE-01)", () => {
    it.each([
        ["LOW", "Low", "#EAF6EF"],
        ["MEDIUM", "Medium", "#FCEFD8"],
        ["HIGH", "High", "#FBE7E4"],
    ])("%s renders the label %s on %s", (value, label, background) => {
        render(<PriorityBadge value={value} />);
        expect(screen.getByText(label)).toHaveStyle(`background-color: ${background}`);
    });

    it("renders a dash when the priority is not set", () => {
        render(<PriorityBadge value={null} />);
        expect(screen.getByText("—")).toBeInTheDocument();
    });
});

describe("RoleBadge (STYLE-01)", () => {
    it.each([
        ["REQUESTER", "Requester"],
        ["IT_STAFF", "IT Staff"],
        ["ADMINISTRATOR", "Administrator"],
    ])("%s renders the label %s", (value, label) => {
        render(<RoleBadge value={value} />);
        expect(screen.getByText(label)).toBeInTheDocument();
    });
});