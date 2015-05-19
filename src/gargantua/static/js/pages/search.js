$(function() {
    bindNavbarSearch();


    //  top navbar 的文章搜索
    function bindNavbarSearch() {
        var $navbarSearchForm = $("form.nav-bar-search");
        var $navbarSearchInput = $("form.nav-bar-search .searchInput");
        var $container = $(".container");

        $navbarSearchForm.on("submit", function() {
            var keyword = $navbarSearchInput.val();

            url = "/search/";
            args = {
                keyword: keyword
            }
            globalFadeLayer.fadeIn();
            $.get(url, args, function(resp) {})
                .done(function(resp) {
                    $container.html(resp);
                    $.globalEval($(".comment-count-js").html());
                })
                .always(function() {
                    globalFadeLayer.fadeOut();
                });

            return false;
        })
    }
})