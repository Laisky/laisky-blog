'use strict';

import { gql } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import jsutils from '@laisky/js-utils';
import { getUserLanguage, graphqlMutation, graphqlQuery, KvKeyLanguage, KvKeyUserToken } from '../library/base.jsx';
import { buildLocationPayload, buildMutationPostCandidates, datetimeLocalValueToISO, toDatetimeLocalValue } from '../library/postMeta.jsx';

export const postEditLoader = async ({ params }) => {
  const gqBody = gql`
        query {
            BlogPosts(
                name: "${params.name}"
                language: ${await getUserLanguage()}
            ) {
                name
                created_at
                modified_at
                type
                title
                menu
                markdown
                tags
                category {
                    name
                    url
                }
                arweave_id {
                    id
                    time
                }
            }
        }
    `;

  const resp = await graphqlQuery(gqBody);
  return resp.BlogPosts[0];
};

export const postPublishLoader = async () => {
  return {
    name: '',
    type: 'markdown',
    title: '',
    language: 'zh_CN',
    markdown: '',
    created_at: new Date().toISOString(),
  };
};

export const PostEdit = ({ isPublish }) => {
  isPublish = isPublish === 'true';
  const [language, setLanguage] = useState(null);
  const [content, setContent] = useState(null);
  const [locationState, setLocationState] = useState({
    status: isPublish ? 'idle' : 'disabled',
    data: null,
    message: isPublish ? 'Location capture is optional and only used for publish analytics.' : '',
  });
  const navigate = useNavigate();
  const params = useParams();

  useEffect(() => {
    (async () => {
      setContent(await renderContent());
    })();
  }, [params.name, language, locationState]);

  useEffect(() => {
    if (!isPublish) {
      return;
    }

    captureLocation();
  }, [isPublish]);

  /**
   * isSchemaValidationError checks whether a mutation failed due to unsupported fields.
   *
   * @param {unknown} err - Mutation error object.
   * @returns {boolean} True when fallback mutation should be attempted.
   */
  const isSchemaValidationError = (err) => {
    const text = `${err?.message || ''}`.toLowerCase();
    return (
      text.includes('is not defined by type') ||
      text.includes('unknown argument') ||
      text.includes('unknown field') ||
      text.includes('unknown input field') ||
      text.includes('cannot query field')
    );
  };

  /**
   * reverseGeocode resolves city-level metadata from coordinates.
   *
   * @param {number} latitude - Latitude value.
   * @param {number} longitude - Longitude value.
   * @returns {Promise<Object>} Reverse geocode result with address and display_name.
   */
  const reverseGeocode = async (latitude, longitude) => {
    const endpoint = new URL('https://nominatim.openstreetmap.org/reverse');
    endpoint.searchParams.set('lat', `${latitude}`);
    endpoint.searchParams.set('lon', `${longitude}`);
    endpoint.searchParams.set('format', 'jsonv2');
    endpoint.searchParams.set('zoom', '10');
    endpoint.searchParams.set('addressdetails', '1');

    const resp = await window.fetch(endpoint.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });
    if (!resp.ok) {
      throw new Error(`Reverse geocode failed: ${resp.status}`);
    }

    return await resp.json();
  };

  /**
   * captureLocation collects GPS coordinates and city metadata for publish analytics.
   *
   * @returns {Promise<void>} Resolves when capture flow completes.
   */
  const captureLocation = async () => {
    if (!isPublish) {
      return;
    }

    if (!navigator?.geolocation) {
      setLocationState({
        status: 'error',
        data: null,
        message: 'Geolocation is not supported in this browser.',
      });
      return;
    }

    setLocationState((prev) => ({
      ...prev,
      status: 'loading',
      message: 'Requesting browser location permission...',
    }));

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 120000,
        });
      });

      let geocodeResult;
      try {
        geocodeResult = await reverseGeocode(position.coords.latitude, position.coords.longitude);
      } catch {
        geocodeResult = {};
      }

      const payload = buildLocationPayload({
        coords: position.coords,
        address: geocodeResult?.address,
        displayName: geocodeResult?.display_name,
      });

      setLocationState({
        status: 'ready',
        data: payload,
        message: payload?.city
          ? `Location captured: ${payload.city} (${payload.latitude}, ${payload.longitude})`
          : `Location captured: ${payload.latitude}, ${payload.longitude}`,
      });
    } catch (err) {
      setLocationState({
        status: 'error',
        data: null,
        message: `Location capture unavailable: ${err?.message || 'permission denied or timeout'}`,
      });
    }
  };

  /**
   * submitWithFallback tries multiple post payload candidates for schema compatibility.
   *
   * @param {string} gqBody - GraphQL mutation string.
   * @param {Object[]} postCandidates - Candidate post payloads.
   * @param {string} token - JWT auth token.
   * @returns {Promise<void>} Resolves on first successful mutation.
   */
  const submitWithFallback = async (gqBody, postCandidates, token) => {
    let lastErr;
    for (let idx = 0; idx < postCandidates.length; idx++) {
      const variables = {
        post: postCandidates[idx],
      };

      try {
        await graphqlMutation(gqBody, variables, {
          Authorization: `Bearer ${token}`,
        });
        return;
      } catch (err) {
        lastErr = err;
        if (!isSchemaValidationError(err) || idx === postCandidates.length - 1) {
          throw err;
        }
      }
    }

    if (lastErr) {
      throw lastErr;
    }
  };

  const submitHandler = async (evt) => {
    evt.preventDefault();
    evt.stopPropagation();

    const postEle = document.getElementById('postEdit');
    const selectedLanguage = postEle.querySelector('.input.postLanguage').value;
    const publishAtValue = postEle.querySelector('.input.postPublishAt').value;

    const basePost = {
      title: postEle.querySelector('.input.postTitle').value,
      name: postEle.querySelector('.input.postName').value,
      markdown: postEle.querySelector('.input.postMarkdown').value,
      type: postEle.querySelector('.input.postType').value,
    };

    // check empty
    for (const k in basePost) {
      if (!basePost[k]) {
        window.alert(`Empty field: ${k}`);
        return;
      }
    }

    let gqBody;
    if (isPublish) {
      gqBody = gql`
                mutation($post: NewBlogPost!) {
                    BlogCreatePost(
                        post: $post,
                    language: ${selectedLanguage},
                    ) {
                        name
                    }
                }
            `;
    } else {
      gqBody = gql`
                mutation($post: NewBlogPost!) {
                    BlogAmendPost(
                        post: $post,
                        language: ${selectedLanguage},
                    ) {
                        name
                    }
                }
            `;
    }

    const publishAtISO = datetimeLocalValueToISO(publishAtValue);
    if (publishAtValue && !publishAtISO) {
      window.alert('Invalid publish datetime');
      return;
    }

    const postCandidates = buildMutationPostCandidates(basePost, {
      publishAtISO,
      includeLocation: isPublish,
      locationPayload: isPublish ? locationState.data : null,
    });

    await submitWithFallback(gqBody, postCandidates, await jsutils.KvGet(KvKeyUserToken));

    navigate(`/p/${basePost.name}/?force=1`);
  };

  useEffect(() => {
    const watchLanguageChange = async () => {
      await jsutils.KvAddListener(
        KvKeyLanguage,
        async (key, op, oldVal, newVal) => {
          if (op !== jsutils.KvOp.SET || key !== KvKeyLanguage || oldVal === newVal) {
            return;
          }

          setLanguage(newVal);
          navigate(0);
        },
        'page_post'
      );
    };

    watchLanguageChange();
  }, [navigate]);

  const renderContent = async () => {
    let post;
    if (isPublish) {
      post = await postPublishLoader({ params });
    } else {
      post = await postEditLoader({ params });
    }

    const initialPublishAt = toDatetimeLocalValue(post.created_at || new Date().toISOString());
    const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    return (
      <div className="posts">
        <div className="post post-editor" id={post.name} key={post.name}>
          <div className="post-editor-header">
            <h2>{isPublish ? 'Publish New Article' : 'Edit Article'}</h2>
            <p>Publish time is editable, and location capture (city + coordinates) is available for analytics on new publications.</p>
          </div>

          <section className="editor-section">
            <h3>Core Metadata</h3>
            <div className="mb-3">
              <label htmlFor="postTitle" className="form-label">
                Title
              </label>
              <input type="text" className="form-control input postTitle" defaultValue={post.title} />
            </div>
            <div className="mb-3">
              <label htmlFor="postName" className="form-label">
                Name
              </label>
              <input
                type="text"
                className="form-control input postName"
                {...(isPublish ? {} : { readOnly: true })}
                defaultValue={post.name}
              />
            </div>
            <div className="mb-3 editor-grid-2">
              <div>
                <label htmlFor="postLanguage" className="form-label">
                  Language
                </label>
                <select className="form-select input postLanguage" defaultValue={post.language}>
                  <option value="en_US">en_US</option>
                  <option value="zh_CN">zh_CN</option>
                </select>
              </div>
              <div>
                <label htmlFor="postType" className="form-label">
                  Type
                </label>
                <select className="form-select input postType" defaultValue={post.type}>
                  <option value="markdown">Markdown</option>
                  <option value="slide">Slide</option>
                </select>
              </div>
            </div>
          </section>

          <section className="editor-section">
            <h3>Publishing Controls</h3>
            <div className="mb-2">
              <label htmlFor="postPublishAt" className="form-label">
                Publish Time
              </label>
              <input type="datetime-local" className="form-control input postPublishAt" defaultValue={initialPublishAt} />
              <div className="form-text">Timezone: {timezoneLabel}. Value is converted and stored as UTC on submit.</div>
            </div>

            {isPublish && (
              <div className={`location-panel location-panel--${locationState.status}`} role="status" aria-live="polite">
                <div className="location-panel-row">
                  <strong>Capture browser location for analytics</strong>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={captureLocation}>
                    Refresh Location
                  </button>
                </div>
                <p className="location-hint">{locationState.message}</p>
                {locationState.data && (
                  <div className="location-facts">
                    <span>City: {locationState.data.city || 'Unknown'}</span>
                    <span>Country: {locationState.data.country || 'Unknown'}</span>
                    <span>
                      Coordinates: {locationState.data.latitude}, {locationState.data.longitude}
                    </span>
                    <span>Accuracy: {locationState.data.accuracy_m ? `${locationState.data.accuracy_m}m` : 'Unknown'}</span>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="editor-section">
            <h3>Content</h3>
            <div className="mb-3">
              <label htmlFor="postMarkdown" className="form-label">
                Markdown
              </label>
              <textarea className="form-control input postMarkdown" defaultValue={post.markdown} rows="50" />
            </div>
          </section>

          <div className="editor-actions">
            <button type="submit" className="btn btn-primary" onClick={submitHandler}>
              {isPublish ? 'Publish' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="postEdit" className="row g-3 g-xl-4 align-items-start scrollable-content">
      {/* blog posts */}
      <div className="col-12 col-xl-9">{content}</div>
    </div>
  );
};
