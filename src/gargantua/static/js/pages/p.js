$(function() {
    updatePageTitle();
    bindImgClick();

    function updatePageTitle() {
        if ($(".post").length == 1) {
            var title = $(".post-title a").html();
            $("head title").html(title);
        }
    }

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