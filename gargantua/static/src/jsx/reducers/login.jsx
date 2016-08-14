const logins = (state = [], action) => {
    switch (action.type) {
        case 'SET_LOGIN':
            return Object.assign({}, state, {
                'loginUser': action.username
            });
        default:
            return state
    }
}

export default logins;
