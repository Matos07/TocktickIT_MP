import ThreadSection from "./ThreadSection.js";
import { fetchInternalNotes, postInternalNote } from "../api/staff.js";

export default function InternalNotesSection({ ticketId }: { ticketId: number }) {
    return (
        <ThreadSection
            ticketId={ticketId}
            variant="internal"
            title="Internal Notes"
            notice="Internal — not visible to the Requester."
            inputLabel="Add Internal Note"
            submitLabel="Post Internal Note"
            emptyText="No internal notes yet."
            load={fetchInternalNotes}
            post={postInternalNote}
        />
    );
}