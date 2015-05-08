$(function() {
    bindPublishForm();


    function bindPublishForm() {
        $(".publish-body").on("submit", "#publishForm", function() {
            var $postTitle = $("#postTitleInput");
            var $postName = $("#postNameInput");
            var $postContent = $("#postContentInput");
            var $postType = $("#postTypeInput");

            var url = "/publish/";
            var args = {
                postTitle: $postTitle.val(),
                postName: $postName.val(),
                postContent: $postContent.val(),
                postType: $postType.val()
            };

            $.postJSON(url, args, function(resp) {
                var $hint = $(".hint span");

                $hint.html(resp.msg);
                if (resp.status == 0) {
                    $hint.removeClass('label-info');
                    $hint.removeClass('label-danger');
                    $hint.addClass('label-success');
                    $hint.html("发布成功，正在跳转...");
                    setTimeout(function() {
                        location.href = "/archives/?page=1";
                    }, 1000);
                } else {
                    $hint.removeClass('label-info');
                    $hint.addClass('label-danger');
                }
            });

            return false;
        })
    }
})