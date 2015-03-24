$(function() {
    $(window).bind("scroll", windowScrollHandler);
    $(".post-title a").bind("click", setHistory);
    resizeImage();


    function setHistory() {
        var id = $(this).parent().parent().prop("id");
        var url = $(this).prop("href");
        history.pushState({}, '', 'archives#' + id);
        window.location.replace(url);
        return false;
    }


    function windowScrollHandler() {
        console.log("windowScrollHandler");

        if ($(window).scrollTop() + $(window).height() > $(document).height() - 400) {
            $(window).unbind('scroll');
            loadMorePosts();
        }
    }

    function getLastPostName() {
        console.log("getLastPostName");

        var lastPost = $("#archives").children().last();
        var href = lastPost.children(".post-title").children().prop("href");
        var postName = href.split("/").pop();

        return postName;
    }

    function loadMorePosts() {
        console.log("loadMorePosts");

        // var url = getBaseUrl() + "/api/posts/get-lastest-posts-by-name?";
        var url = "api/posts/get-lastest-posts-by-name";
        var data = {
            "since_name": getLastPostName()
        };

        $.getJSON(url, data, function(data) {
                console.log(data['status']);
            })
            .done(function(data) {
                $("#archives").append(data['data']);
            })
            .always(function() {
                $(window).bind('scroll', windowScrollHandler);
            });
    }
});