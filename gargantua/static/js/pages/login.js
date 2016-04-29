$(function() {
    bindLoginHandler();

    // Login form
    function bindLoginHandler() {
        // console.log("bindLoginHandler");

        $(".login-body").on("click", "#signinBtn", function() {
            var $emailInput = $("#emailInput"),
                $passwdInput = $("#passwdInput"),
                $keepLoginInput = $("#keepLoginInput"),
                $hintText = $(".login-body .hint .hint-text"),
                email = $emailInput.val(),
                passwd = $passwdInput.val().getMD5(),
                isKeepLogin = $keepLoginInput.prop("checked"),
                url = '/api/user/login/',
                data = {
                    email: email,
                    password: passwd,
                    is_keep_login: isKeepLogin
                };

            $.postJSON(url, data, function(resp) {
                $hintText.html(resp.msg);
                if (resp.status == 0) {
                    // 登陆成功
                    $hintText.removeClass('label-warning');
                    $hintText.addClass("label-success");
                    $hintText.html("登陆成功，正在跳转");
                    setTimeout(function() {
                        var redirectTo = QueryString['next'];
                        location.href = redirectTo;
                        // TODO 还没实现 popStat
                        // if(history.length == 0) {
                        //     location.href = "/archives/?page=1";
                        // }else {
                        //     history.back();
                        // }
                    }, 1000);
                    return;
                } else {
                    // 登录失败
                    $hintText.addClass("label-warning");
                }
            });

            return false;
        });
    }
});
