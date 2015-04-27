$(function() {
    // bindWindowScrollHandler();
    bindChangePage();


    function bindChangePage() {
        function updateContainerByPage(page) {
            var url = '/api/posts/get-post-by-page/?page=' + page;
            var data = {
                ajax: "body"
            };
            $.get(url, data, function(data) {})
                .done(function(data) {
                    $(".container").html(data);
                    $.globalEval($(".comment-count-js").html());
                    history.pushState({}, '', '/archives/?page=' + page);
                });
        }

        $(document).on("click", "li a.page", function() {
            var page = $(this).html();
            updateContainerByPage(page);
            return false;
        });

        $(document).on("click", "li a.page-previous, li a.page-next", function() {
            var page = $(this).data("page");
            updateContainerByPage(page);
            return false;
        });

        // $(document).on("click", "li a.page-next", function() {
        //     var page = $(this).data("page");
        //     updateContainerByPage(page);
        // });
    }


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