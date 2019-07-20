/*
 * 博客登录页
 */

'use strict';

import { Link } from 'react-router';
import { BaseComponent } from '../components/base.jsx';
import { Auth } from '../components/auth.jsx';

class Login extends BaseComponent {
    render() {
        return (
            <div id="login">
                <Auth method="POST"
                    action={window.graphqlAPI}
                    accountName="email"
                    accountLabel="邮箱"
                    accountPlaceholder="请输入登录邮箱" />
            </div>
        );
    }
}


export { Login };
