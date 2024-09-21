
'use strict';

import React from 'react';

import { Admin } from './admin.jsx';
import { Categories } from './categories.jsx';
import { Tags } from './tags.jsx';

export const Sidebar = () => {
    return (
        <>
            <Categories />
            <Admin />
            <Tags />
        </>
    )
}
