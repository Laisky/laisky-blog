
'use strict';

import React from 'react';

import { Login } from './login.jsx';
import { Categories } from './categories.jsx';
import { Tags } from './tags.jsx';

export const Sidebar = () => {
    return (
        <>
            <Categories />
            <Login />
            <Tags />
        </>
    )
}
