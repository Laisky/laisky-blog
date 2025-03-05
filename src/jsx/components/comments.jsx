import React, { useState, useEffect, useRef } from 'react';
import { gql } from 'graphql-request';
import { graphqlQuery } from '../library/base.jsx';
import { formatRelativeTime, SetCache, GetCache } from '../library/libs.js';

// Cache keys for user data
const CACHE_KEY_AUTHOR_NAME = 'comment_author_name';
const CACHE_KEY_AUTHOR_EMAIL = 'comment_author_email';
const CACHE_KEY_AUTHOR_WEBSITE = 'comment_author_website';

/**
 * Main Comments component
 */
export const Comments = ({ postName }) => {
    const [comments, setComments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [commentCount, setCommentCount] = useState(0);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [replyTo, setReplyTo] = useState(null);
    const commentInputRef = useRef(null);

    // Form state
    const [authorName, setAuthorName] = useState('');
    const [authorEmail, setAuthorEmail] = useState('');
    const [authorWebsite, setAuthorWebsite] = useState('');
    const [commentContent, setCommentContent] = useState('');
    const [formDataLoaded, setFormDataLoaded] = useState(false);

    // Load user data from cache when component mounts
    useEffect(() => {
        const loadUserData = async () => {
            try {
                const cachedName = await GetCache(CACHE_KEY_AUTHOR_NAME);
                const cachedEmail = await GetCache(CACHE_KEY_AUTHOR_EMAIL);
                const cachedWebsite = await GetCache(CACHE_KEY_AUTHOR_WEBSITE);

                if (cachedName) setAuthorName(cachedName);
                if (cachedEmail) setAuthorEmail(cachedEmail);
                if (cachedWebsite) setAuthorWebsite(cachedWebsite);

                setFormDataLoaded(true);
            } catch (error) {
                console.error("Failed to load cached user data:", error);
            }
        };

        loadUserData();
    }, []);

    // Save user data to cache
    const saveUserDataToCache = async () => {
        try {
            await SetCache(CACHE_KEY_AUTHOR_NAME, authorName);
            await SetCache(CACHE_KEY_AUTHOR_EMAIL, authorEmail);
            if (authorWebsite) {
                await SetCache(CACHE_KEY_AUTHOR_WEBSITE, authorWebsite);
            }
            console.debug("User comment data saved to cache");
        } catch (error) {
            console.error("Failed to cache user data:", error);
        }
    };

    // Load comments for the current post
    useEffect(() => {
        const fetchComments = async () => {
            setIsLoading(true);
            try {
                // Fetch comments
                const commentsQuery = gql`
                    query {
                        BlogComments(
                        postName: "${postName}"
                        page: { page: ${page}, size: 10 }
                        sort: { sort_by: "created_at", order: DESC }
                        ) {
                        id
                        content
                        authorName
                        authorWebsite
                        createdAt
                        isApproved
                        likes
                        parentId
                        replies {
                            id
                            content
                            authorName
                            authorWebsite
                            createdAt
                            isApproved
                            likes
                        }
                        }

                        BlogCommentCount(postName: "${postName}")
                    }`;

                const resp = await graphqlQuery(commentsQuery);

                // Update state with fetched comments
                if (page === 0) {
                    setComments(resp.BlogComments);
                } else {
                    setComments(prevComments => [...prevComments, ...resp.BlogComments]);
                }

                setCommentCount(resp.BlogCommentCount);
                setHasMore(resp.BlogComments.length === 10);
            } catch (err) {
                console.error("Error fetching comments:", err);
                setError("Failed to load comments. Please try again later.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchComments();
    }, [postName, page]);

    // Submit a new comment
    const handleSubmitComment = async (e) => {
        e.preventDefault();

        if (!commentContent.trim()) {
            return;
        }

        try {
            const createCommentMutation = gql`
                mutation {
                BlogCreateComment(
                    postName: "${postName}"
                    content: "${commentContent.replace(/"/g, '\\"')}"
                    authorName: "${authorName.replace(/"/g, '\\"')}"
                    authorEmail: "${authorEmail.replace(/"/g, '\\"')}"
                    authorWebsite: "${authorWebsite.replace(/"/g, '\\"')}"
                    ${replyTo ? `parentId: "${replyTo}"` : ''}
                ) {
                    id
                    content
                    authorName
                    authorWebsite
                    createdAt
                    isApproved
                    likes
                    parentId
                }
                }
            `;

            const resp = await graphqlQuery(createCommentMutation);
            const newComment = resp.BlogCreateComment;

            // Save user data to cache after successful comment submission
            await saveUserDataToCache();

            // Update comments state with the new comment
            if (replyTo) {
                // Add the reply to the appropriate parent comment
                setComments(prevComments =>
                    prevComments.map(comment =>
                        comment.id === replyTo
                            ? {
                                ...comment,
                                replies: [...(comment.replies || []), newComment]
                            }
                            : comment
                    )
                );
            } else {
                // Add new top-level comment
                setComments(prevComments => [newComment, ...prevComments]);
            }

            // Reset form (but keep user info)
            setCommentContent('');
            setReplyTo(null);

            // Update comment count
            setCommentCount(prevCount => prevCount + 1);
        } catch (err) {
            console.error("Error submitting comment:", err);
            setError("Failed to post comment. Please try again later.");
        }
    };

    // Toggle like on a comment
    const handleLikeComment = async (commentId) => {
        try {
            const likeCommentMutation = gql`
                mutation {
                BlogToggleCommentLike(
                    commentId: "${commentId}"
                ) {
                    id
                    likes
                }
                }
            `;

            const resp = await graphqlQuery(likeCommentMutation);
            const updatedComment = resp.BlogToggleCommentLike;

            // Update the likes count in the state
            setComments(prevComments =>
                prevComments.map(comment =>
                    comment.id === commentId
                        ? { ...comment, likes: updatedComment.likes }
                        : {
                            ...comment,
                            replies: comment.replies?.map(reply =>
                                reply.id === commentId
                                    ? { ...reply, likes: updatedComment.likes }
                                    : reply
                            ) || []
                        }
                )
            );
        } catch (err) {
            console.error("Error liking comment:", err);
        }
    };

    // Handle reply to comment
    const handleReply = (commentId) => {
        setReplyTo(commentId);
        // Scroll to comment form
        if (commentInputRef.current) {
            commentInputRef.current.focus();
        }
    };

    // Cancel reply
    const handleCancelReply = () => {
        setReplyTo(null);
    };

    // Load more comments
    const handleLoadMore = () => {
        setPage(prevPage => prevPage + 1);
    };

    return (
        <div className="blog-comments">
            <h3 className="comments-title">Comments ({commentCount})</h3>

            {/* Comment form */}
            <div className="comment-form-container">
                <h4>{replyTo ? 'Reply to comment' : 'Leave a comment'}</h4>
                {replyTo && (
                    <div className="replying-to">
                        Replying to comment. <button onClick={handleCancelReply} className="btn btn-sm btn-outline-secondary">Cancel</button>
                    </div>
                )}
                <form onSubmit={handleSubmitComment} className="comment-form">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Name (required)"
                                value={authorName}
                                onChange={(e) => setAuthorName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="col-md-6">
                            <input
                                type="email"
                                className="form-control"
                                placeholder="Email (required, not published)"
                                value={authorEmail}
                                onChange={(e) => setAuthorEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                    <div className="mb-3 mt-2">
                        <input
                            type="url"
                            className="form-control"
                            placeholder="Website (optional)"
                            value={authorWebsite}
                            onChange={(e) => setAuthorWebsite(e.target.value)}
                        />
                    </div>
                    <div className="mb-3">
                        <textarea
                            ref={commentInputRef}
                            className="form-control"
                            rows="4"
                            placeholder="Your comment"
                            value={commentContent}
                            onChange={(e) => setCommentContent(e.target.value)}
                            required
                        ></textarea>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                        <button type="submit" className="btn btn-primary">
                            Post Comment
                        </button>
                        {formDataLoaded && (authorName || authorEmail || authorWebsite) && (
                            <small className="text-muted">
                                Your information is saved for next time
                            </small>
                        )}
                    </div>
                </form>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {/* Comments list */}
            <div className="comments-list">
                {comments.length === 0 && !isLoading ? (
                    <div className="no-comments">No comments yet. Be the first to comment!</div>
                ) : (
                    <div>
                        {comments.map(comment => (
                            <CommentItem
                                key={comment.id}
                                comment={comment}
                                onReply={handleReply}
                                onLike={handleLikeComment}
                            />
                        ))}

                        {hasMore && (
                            <div className="load-more">
                                <button
                                    className="btn btn-outline-primary"
                                    onClick={handleLoadMore}
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Loading...' : 'Load More Comments'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {isLoading && <div className="loading">Loading comments...</div>}
            </div>
        </div>
    );
};

// Individual comment component remains the same
const CommentItem = ({ comment, onReply, onLike }) => {
    const [showReplies, setShowReplies] = useState(true);

    return (
        <div className="comment-item" id={`comment-${comment.id}`}>
            <div className="comment-header">
                <div className="comment-author">
                    {comment.authorWebsite ? (
                        <a href={comment.authorWebsite} target="_blank" rel="noopener noreferrer">
                            {comment.authorName}
                        </a>
                    ) : (
                        <span>{comment.authorName}</span>
                    )}
                </div>
                <div className="comment-date" title={new Date(comment.createdAt).toLocaleString()}>
                    {formatRelativeTime(comment.createdAt)}
                </div>
            </div>
            <div className="comment-content" dangerouslySetInnerHTML={{ __html: comment.content }}></div>
            <div className="comment-actions">
                <button className="btn btn-sm btn-link" onClick={() => onReply(comment.id)}>
                    Reply
                </button>
                <button className="btn btn-sm btn-link like-button" onClick={() => onLike(comment.id)}>
                    <span className="like-icon">❤</span> {comment.likes}
                </button>
            </div>

            {/* Replies */}
            {comment.replies && comment.replies.length > 0 && (
                <div className="comment-replies-container">
                    <button
                        className="btn btn-sm btn-link toggle-replies"
                        onClick={() => setShowReplies(!showReplies)}
                    >
                        {showReplies ? 'Hide Replies' : `Show ${comment.replies.length} Replies`}
                    </button>

                    {showReplies && (
                        <div className="comment-replies">
                            {comment.replies.map(reply => (
                                <CommentItem
                                    key={reply.id}
                                    comment={reply}
                                    onReply={onReply}
                                    onLike={onLike}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
