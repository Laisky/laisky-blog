import { createStore, combineReducers } from 'redux'

import logins from './login.jsx'


export const rootReducer = combineReducers({
    logins
})

export const store = createStore(rootReducer);
