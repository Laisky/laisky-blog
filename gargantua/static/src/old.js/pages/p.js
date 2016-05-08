"use strict;"
$(function() {
    updatePageTitle();
    bindImgClick();
    bindPostAuth();
    // hljs.initHighlightingOnLoad();


    function bindPostAuth() {
        $(".post-auth-body .submitBtn").on("click", function() {
            var postName = $(".post-auth-body form").data("post-name"),
                url = location.pathname,
                $hint = $(".post-auth-body .hint-text"),
                password = $(".post-auth-body .passwdInput").val();

            $.postJSON(url, {
                name: postName,
                password: password
            }, function(resp) {
                if (resp.status != 0) {
                    $hint.html(resp.msg);
                } else {
                    $hint.html("验证成功，正在跳转...");
                    setTimeout(function() {
                        location.reload();
                    }, 1000);
                }

            });
            return false;
        })
    }


    // 更新文章标题的链接
    function updatePageTitle() {
        if ($(".post").length == 1) {
            var title = $(".post-title a").html();

            $("head title").html(title);
        }
    }


    // 点击图片弹出大图
    function bindImgClick() {
        var $imgModal = $("#img-modal"),
            $modalImg = $("#img-modal .modal-body img");

        $(".container").on("click", "#archives img", imgClickHandler);

        function imgClickHandler() {
            var $this = $(this);

            $modalImg.prop("src", $this.prop("src"));
            $imgModal.modal({
                show: true
            });
            return false;
        }
    }
});
