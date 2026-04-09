 $(document).ready(function () {
        $(".flip-card").click(function () {
          // Reset other cards
          $(".flip-card").not(this).removeClass("flipped");

          // Toggle current card
          $(this).toggleClass("flipped");
        });

        // Prevent link clicks from triggering flip
        $(".flip-card a").click(function (e) {
          e.stopPropagation();
        });
      });