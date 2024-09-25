'use strict';

import { gql } from 'graphql-request';
import React, { useEffect, useState } from 'react';
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

    const getTagClickHandler = (tag) => () => {
        if (!google || !google.search.cse.element.getElement('post_search')) return;

        google.search.cse.element.getElement('post_search').execute(tag);
    };

    return (
        <section className="row console tags">
            <h2>Tags</h2>
            <div className="tag-labels">
                {Array.isArray(tags) && tags.map(tag => (
                    <span key={tag} onClick={getTagClickHandler(tag)} className="badge text-bg-info">
                        {tag}
                    </span>
                ))}
            </div>
        </section>
    );
}
