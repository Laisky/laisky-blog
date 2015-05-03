$(function() {
    bindLoginHandler();

    // Login form
    function bindLoginHandler() {
        console.log("bindLoginHandler");

        $( ".login-body" ).on("click", "#signinBtn", function() {
            console.log("click!!!")

            var $emailInput = $("#emailInput");
            var $passwdInput = $("#passedInput");
            var $keepLoginInput = $("#keepLoginInput");

            var email = $emailInput.html();
            var passwd = $passwdInput.html();
            var isKeepLogin = $keepLoginInput.checked;

            var url = '/api/user/login/';
            var data = {
                email: email,
                password: passwd,
                is_keep_login: isKeepLogin
            };

            $.postJSON(url, data, function(resp) {
                    console.log("POST" + resp);
                })
                .always(function(resp) {
                    console.log("always");
                    location.reload();
                });

            return false;
        });
    }
});