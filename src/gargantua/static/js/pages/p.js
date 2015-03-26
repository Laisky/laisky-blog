$(function() {
    updatePageTitle();

    function updatePageTitle() {
        if($(".post").length == 1) {
            var title = $(".post-title a").html();
            $("head title").html(title);
        }
    }
});