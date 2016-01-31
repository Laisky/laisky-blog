$(function() {
    bindPublishForm();


    function bindPublishForm() {
        $(".publish-body").off("submit", "#publishForm", amendPost);
        $(".publish-body").on("submit", "#publishForm", amendPost);
    }

    function amendPost() {
        var $postTitle = $("#postTitleInput");
        var $postName = $("#postNameInput");
        var $postContent = $("#postContentInput");
        var $postType = $("#postTypeInput");

        var url = "/amend/";
        var data = {
            postTitle: $postTitle.val(),
            postName: $postName.val(),
            postContent: $postContent.val(),
            postType: $postType.val(),
            _xsrf: getCookie("_xsrf")
        };

        $.ajax({
                url: url,
                method: 'PATCH',
                data: data
            })
            .always(function(resp) {
                resp = $.parseJSON(resp);
                var $hint = $(".hint span");

                $hint.html(resp.msg);
                if (resp.status == 0) {
                    $hint.removeClass('label-info');
                    $hint.removeClass('label-danger');
                    $hint.addClass('label-success');
                    $hint.html("发布成功，正在跳转...");
                    setTimeout(function() {
                        location.href = "/p/" + $postName.val() + "/";
                    }, 500);
                } else {
                    $hint.removeClass('label-info');
                    $hint.addClass('label-danger');
                }
            });

        return false;
    }
});
