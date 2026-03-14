import jsutils from '@laisky/js-utils';
import { gql } from 'graphql-request';
import React, { useEffect, useRef, useState } from 'react';
import { graphqlQuery, ts2UTC } from '../library/base.jsx';
import { Tooltip } from './Tooltip.jsx';

// Cache keys for user data
const CACHE_KEY_AUTHOR_NAME = 'comment_author_name';
const CACHE_KEY_AUTHOR_EMAIL = 'comment_author_email';
const CACHE_KEY_AUTHOR_WEBSITE = 'comment_author_website';
const CACHE_KEY_LIKED_COMMENTS = 'comment_liked_comments';

/**
 * Update a comment's likes count by adding the specified delta
 * @param {Array} comments - The comments array
 * @param {string} commentId - The ID of the comment to update
 * @param {number} delta - The amount to change the likes by (+1 or -1)
 * @returns {Array} - Updated comments array
 */
const updateCommentLikes = (comments, commentId, delta) => {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return {
        ...comment,
        likes: comment.likes + delta,
      };
    } else if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: comment.replies.map((reply) => {
          if (reply.id === commentId) {
            return {
              ...reply,
              likes: reply.likes + delta,
            };
          }
          return reply;
        }),
      };
    }
    return comment;
  });
};

/**
 * Update a comment's likes count to a specific value from server
 * @param {Array} comments - The comments array
 * @param {string} commentId - The ID of the comment to update
 * @param {number} likesCount - The new likes count from server
 * @returns {Array} - Updated comments array
 */
const updateCommentWithActualLikes = (comments, commentId, likesCount) => {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return {
        ...comment,
        likes: likesCount,
      };
    } else if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: comment.replies.map((reply) => {
          if (reply.id === commentId) {
            return {
              ...reply,
              likes: likesCount,
            };
          }
          return reply;
        }),
      };
    }
    return comment;
  });
};

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
  const [likedComments, setLikedComments] = useState({});
  const commentInputRef = useRef(null);

  // Form state
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [authorWebsite, setAuthorWebsite] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [formDataLoaded, setFormDataLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add this useEffect to load liked comments
  useEffect(() => {
    const loadLikedComments = async () => {
      try {
        const cachedLikedComments = (await jsutils.GetCache(CACHE_KEY_LIKED_COMMENTS)) || {};
        setLikedComments(cachedLikedComments);
      } catch (error) {
        console.error('Failed to load liked comments data:', error);
      }
    };

    loadLikedComments();
  }, []);

  // Load user data from cache when component mounts
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const cachedName = await jsutils.GetCache(CACHE_KEY_AUTHOR_NAME);
        const cachedEmail = await jsutils.GetCache(CACHE_KEY_AUTHOR_EMAIL);
        const cachedWebsite = await jsutils.GetCache(CACHE_KEY_AUTHOR_WEBSITE);

        if (cachedName) setAuthorName(cachedName);
        if (cachedEmail) setAuthorEmail(cachedEmail);
        if (cachedWebsite) setAuthorWebsite(cachedWebsite);

        setFormDataLoaded(true);
      } catch (error) {
        console.error('Failed to load cached user data:', error);
      }
    };

    loadUserData();
  }, []);

  // Save user data to cache
  const saveUserDataToCache = async () => {
    try {
      await jsutils.SetCache(CACHE_KEY_AUTHOR_NAME, authorName);
      await jsutils.SetCache(CACHE_KEY_AUTHOR_EMAIL, authorEmail);
      if (authorWebsite) {
        await jsutils.SetCache(CACHE_KEY_AUTHOR_WEBSITE, authorWebsite);
      }
    } catch {
      // Cache write failed — user data will need to be re-entered next time
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

        // Validate response
        if (!resp || !resp.BlogComments) {
          throw new Error('Invalid response from server');
        }

        // Update state with fetched comments
        if (page === 0) {
          setComments(resp.BlogComments || []);
        } else {
          setComments((prevComments) => [...prevComments, ...(resp.BlogComments || [])]);
        }

        setCommentCount(resp.BlogCommentCount || 0);
        setHasMore((resp.BlogComments || []).length === 10);
      } catch (err) {
        console.error('Error fetching comments:', err);
        setError('Failed to load comments. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchComments();
  }, [postName, page]);

  // Submit a new comment
  const handleSubmitComment = async (e) => {
    e.preventDefault();

    if (!commentContent.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const createCommentMutation = gql`
                mutation {
                    BlogCreateComment(
                        postName: "${postName}"
                        content: ${JSON.stringify(commentContent).slice(1, -1)}
                        authorName: ${JSON.stringify(authorName).slice(1, -1)}
                        authorEmail: ${JSON.stringify(authorEmail).slice(1, -1)}
                        authorWebsite: ${JSON.stringify(authorWebsite).slice(1, -1)}
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
        setComments((prevComments) =>
          prevComments.map((comment) =>
            comment.id === replyTo
              ? {
                  ...comment,
                  replies: [...(comment.replies || []), newComment],
                }
              : comment
          )
        );
      } else {
        // Add new top-level comment
        setComments((prevComments) => [newComment, ...prevComments]);
      }

      // Reset form (but keep user info)
      setCommentContent('');
      setReplyTo(null);

      // Update comment count
      setCommentCount((prevCount) => prevCount + 1);
    } catch (err) {
      console.error('Error submitting comment:', err);
      setError('Failed to post comment. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle like on a comment
  const handleLikeComment = async (commentId) => {
    // Check if already liked to prevent duplicate likes
    if (likedComments[commentId]) {
      return; // Don't allow liking again
    }

    try {
      // Show temporary optimistic UI update
      setComments((prevComments) => updateCommentLikes(prevComments, commentId, 1));

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

      if (!resp || !resp.BlogToggleCommentLike) {
        throw new Error('Invalid response from server');
      }

      const updatedComment = resp.BlogToggleCommentLike;

      // Update liked comments state and save to cache
      const newLikedComments = { ...likedComments, [commentId]: true };
      setLikedComments(newLikedComments);
      await jsutils.SetCache(CACHE_KEY_LIKED_COMMENTS, newLikedComments);

      // Update with actual server value
      setComments((prevComments) => updateCommentWithActualLikes(prevComments, commentId, updatedComment.likes));
    } catch (err) {
      console.error('Error liking comment:', err);
      // Revert optimistic update
      setComments((prevComments) => updateCommentLikes(prevComments, commentId, -1));
      setError('Failed to like comment. Please try again later.');
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
    setPage((prevPage) => prevPage + 1);
  };

  return (
    <div className="blog-comments">
      <h3 className="comments-title">Comments ({commentCount})</h3>

      {/* Comment form */}
      <div className="comment-form-container">
        <h4>{replyTo ? 'Reply to comment' : 'Leave a comment'}</h4>
        {replyTo && (
          <div className="replying-to">
            Replying to comment.{' '}
            <button onClick={handleCancelReply} className="btn btn-sm btn-link p-0 ms-1 cancel-reply-btn">
              Cancel
            </button>
          </div>
        )}
        <form onSubmit={handleSubmitComment} className="comment-form">
          <div className="row g-3 mb-3">
            <div className="col-12 col-sm-6">
              <div className="form-group">
                <label htmlFor="authorName" className="form-label">
                  Name <span className="required-mark">*</span>
                </label>
                <input
                  id="authorName"
                  type="text"
                  className="form-control"
                  placeholder="Your name"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  required
                  maxLength={100}
                />
              </div>
            </div>
            <div className="col-12 col-sm-6">
              <div className="form-group">
                <label htmlFor="authorEmail" className="form-label">
                  Email <span className="required-mark">*</span>
                </label>
                <input
                  id="authorEmail"
                  type="email"
                  className="form-control"
                  placeholder="Your email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  required
                  maxLength={254}
                />
              </div>
            </div>
            <div className="col-12">
              <div className="form-group">
                <label htmlFor="authorWebsite" className="form-label">
                  Website <span className="optional-mark">(Optional)</span>
                </label>
                <input
                  id="authorWebsite"
                  type="url"
                  className="form-control"
                  placeholder="https://example.com"
                  value={authorWebsite}
                  onChange={(e) => setAuthorWebsite(e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>
            <div className="col-12">
              <div className="form-group">
                <label htmlFor="commentContent" className="form-label">
                  Comment <span className="required-mark">*</span>
                </label>
                <textarea
                  id="commentContent"
                  ref={commentInputRef}
                  className="form-control"
                  rows="4"
                  placeholder="Write your comment here..."
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                  required
                  maxLength={5000}
                ></textarea>
              </div>
            </div>
          </div>
          <div className="d-flex justify-content-between align-items-center flex-wrap">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Posting...' : 'Post Comment'}
            </button>
            {formDataLoaded && (authorName || authorEmail || authorWebsite) && (
              <small className="text-muted">Info saved for next time</small>
            )}
          </div>
        </form>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Comments list */}
      <div className="comments-list">
        {comments.length === 0 && !isLoading ? (
          <div className="no-comments">No comments yet. Be the first to comment!</div>
        ) : (
          <div>
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={handleReply}
                onLike={handleLikeComment}
                isLiked={likedComments[comment.id] || false}
                likedComments={likedComments}
              />
            ))}

            {hasMore && (
              <div className="load-more">
                <button className="btn btn-outline-primary" onClick={handleLoadMore} disabled={isLoading}>
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
const CommentItem = ({ comment, onReply, onLike, isLiked, likedComments }) => {
  const [showReplies, setShowReplies] = useState(true);

  return (
    <div className="comment-item" id={`comment-${comment.id}`}>
      <div className="comment-header">
        <div className="comment-avatar">{comment.authorName ? comment.authorName.charAt(0).toUpperCase() : '?'}</div>
        <div className="comment-meta">
          <div className="comment-author">
            {comment.authorWebsite ? (
              <a href={comment.authorWebsite} target="_blank" rel="noopener noreferrer">
                {comment.authorName}
              </a>
            ) : (
              <span>{comment.authorName}</span>
            )}
          </div>
          <Tooltip content={ts2UTC(comment.createdAt)} placement="top">
            <div className="comment-date tooltip-trigger">{jsutils.formatRelativeTime(comment.createdAt)}</div>
          </Tooltip>
        </div>
      </div>
      <div className="comment-content" dangerouslySetInnerHTML={{ __html: comment.content }}></div>
      <div className="comment-actions">
        <button className="btn btn-sm btn-link" onClick={() => onReply(comment.id)}>
          Reply
        </button>
        <button
          className={`btn btn-sm btn-link like-button ${isLiked ? 'liked' : ''}`}
          onClick={() => onLike(comment.id)}
          disabled={isLiked}
        >
          <span className="like-icon">❤</span> {comment.likes}
        </button>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies-container">
          <button className="btn btn-sm btn-link toggle-replies" onClick={() => setShowReplies(!showReplies)}>
            {showReplies ? 'Hide Replies' : `Show ${comment.replies.length} Replies`}
          </button>

          {showReplies && (
            <div className="comment-replies">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onReply={onReply}
                  onLike={onLike}
                  isLiked={likedComments?.[reply.id] || false}
                  likedComments={likedComments}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
