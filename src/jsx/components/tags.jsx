'use strict';

import { gql } from 'graphql-request';
import React, { useEffect, useState } from 'react';
import { Tag } from 'lucide-react';
import { graphqlQuery } from '../library/base';

export const Tags = () => {
    const [tags, setTags] = useState([]);

    useEffect(() => {
        (async () => {
            const gqBody = gql`
                query {
                    BlogTags
                }
            `;

            const resp = await graphqlQuery(gqBody);
            setTags(resp.BlogTags);
        })();
    }, []);

    const getTagClickHandler = (tag) => async (evt) => {
        evt.preventDefault();
        evt.stopPropagation();

        if (window.google && window.google.search.cse.element.getElement('post_search')) {
            google.search.cse.element.getElement('post_search').execute(tag);
        }
    };

    return (
        <section className="row console tags">
            <h2 className="d-flex align-items-center">
                <Tag size={14} className="me-2" />
                Tags
            </h2>
            <div className="tag-labels">
                {Array.isArray(tags) &&
                    tags.map((tag) => (
                        <span key={tag} onClick={getTagClickHandler(tag)} className="tag-chip">
                            {tag}
                        </span>
                    ))}
            </div>
        </section>
    );
};
