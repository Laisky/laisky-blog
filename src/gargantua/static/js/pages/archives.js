$(function() {
    // bindWindowScrollHandler();


    function bindWindowScrollHandler() {
        $(window).on("scroll", function() {
            if ($(".post").length > 1) {
                if ($(window).scrollTop() + $(window).height() > $(document).height() - 400) {
                    $(window).unbind("scroll");
                    loadMorePosts();
                }
            }
        });
    }

    function getLastPostName() {
        var lastPost = $("#archives").children().last();
        var href = lastPost.children(".post-title").children().prop("href");
        var postName = href.split("/").pop();
        // postName = postName.slice(0, postName.indexOf("#"));

        return postName;
    }

    function loadMorePosts() {
        var url = "/api/posts/get-lastest-posts-by-name/";
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