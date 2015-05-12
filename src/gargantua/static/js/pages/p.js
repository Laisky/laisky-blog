$(function() {
    updatePageTitle();
    bindImgClick();
    hljs.initHighlightingOnLoad();


    // 更新文章标题的链接
    function updatePageTitle() {
        if ($(".post").length == 1) {
            var title = $(".post-title a").html();
            $("head title").html(title);
        }
    }


    // 点击图片弹出大图
    function bindImgClick() {
        var $imgModal = $("#img-modal");
        var $modalImg = $("#img-modal .modal-body img");
        $(".container").on("click", "#archives img", imgClickHandler);

        function imgClickHandler() {
            var $this = $(this);
            console.log($this.prop("src"));
            $modalImg.prop("src", $this.prop("src"));
            $imgModal.modal({
                show: true
            });
            return false;
        }
    }
});