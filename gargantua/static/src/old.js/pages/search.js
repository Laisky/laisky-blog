$(function() {
    bindNavbarSearch();


    //  top navbar 的文章搜索
    function bindNavbarSearch() {
        var $navbarSearchForm = $("form.nav-bar-search"),
            $navbarSearchInput = $("form.nav-bar-search .searchInput"),
            $container = $(".container");

        $navbarSearchForm.on("submit", function() {
            var keyword = $navbarSearchInput.val(),
                url = "/search/",
                args = {
                    keyword: keyword
                };

            globalFadeLayer.fadeIn();
            $.get(url, args, function(resp) {})
                .done(function(resp) {
                    $container.html(resp);
                    $.globalEval($(".comment-count-js").html());
                    history.pushState({}, '', '/search/?keyword=' + keyword);
                })
                .always(function() {
                    globalFadeLayer.fadeOut();
                });

            return false;
        })
    }
});
