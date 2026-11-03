import ThreadSection from "./ThreadSection.js";
import { fetchComments, postComment } from "../api/tickets.js";

export default function CommentsSection({ ticketId }: { ticketId: number }) {
    return (
        <ThreadSection
            ticketId={ticketId}
            variant="public"
            title="Public Comments"
            inputLabel="Add Public Comment"
            submitLabel="Post Comment"
            emptyText="No comments yet."
            load={fetchComments}
            post={postComment}
        />
    );
}