$(function() {
    jumpOutOf404();


    function jumpOutOf404() {
        var now_url = location.pathname;
        if (location.pathname != "/404.html") {
            return false;
        }

        var timer = setInterval(
            function() {
                changeTimeCount();
            },
            1000
        );

        var url = '/archives/';
        var archives_data = "";

        function preLoadArchives() {
            $.get(url, {
                    "ajax": "body"
                }, function(data) {})
                .done(function(data) {
                    archives_data = data;
                });
        }
        preLoadArchives();

        function changeTimeCount() {
            var sec = Number($("#count").html());
            if (sec > 1) {
                $("#count").html(sec - 1);
            } else {
                clearInterval(timer);
                if (!archives_data) {
                    window.setTimeout(function() {
                        changeTimeCount();
                    }, 1000);
                    return;
                }

                $(".container").html(archives_data);
                $.globalEval($(".comment-count-js").html());
                history.pushState({}, '', url);
            }
        }
    }
});