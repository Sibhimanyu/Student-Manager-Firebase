export function closeAllDiv() {
    document.getElementById("studentDirectory").style.display = "none";
    document.getElementById("manageStudents").style.display = "none";
    document.getElementById("allComments").style.display = "none";
    document.getElementById("statistics").style.display = "none";
    document.getElementById("signedOut").style.display = "none";
}

// Function to close the edit modal
export function closeModals() {
    try{
        document.getElementById("commentActionModal").style.display = "none";
    } catch (error) {
        console.error("Error closing modals:", error);
    }
    document.getElementById("editModal").style.display = "none";
    document.getElementById("userModal").style.display = "none";
    document.getElementById("editCommentText").value = ""; // Clear the textarea
    document.getElementById("addModal").style.display = "none";
    document.getElementById("addCommentText").value = ""; // Clear the textarea
    document.getElementById("commentDate").value = ""; // Clear the date input
    document.getElementById("sidebar").style.width = "0";
}

export function displayAIContent(ai) {
    var aiContainer = document.getElementById("aiContentContainer");

    // Format AI-generated content as bullet points
    var formattedAIText = ai
        .split("\n")
        .map((line) => {
            return line.trim()
                ? "<li>" +
                      line
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/^\*\s*/, "") +
                      "</li>"
                : "";
        })
        .join("");

    // Always show the "Powered by" text
    aiContainer.innerHTML =
        '<h3 class="ai-title">AI-generated Summary:</h3>' +
        (ai === "Loading"
            ? '<p>Loading...</p>'
            : "<ul>" + formattedAIText + "</ul>") +
        '<span class="ai-powered-by">Powered by Google Gemini 2.0 Flash</span>';
}

export function showNotificationOverlay(text) {
    document.getElementById("notificationOverlay").innerHTML = text;
    var notification = document.getElementById("notificationOverlay");
    notification.style.display = "block";
    setTimeout(function () {
        notification.style.display = "none";
    }, 10000);
}

export function renderLastWeekCommentsChart(lastWeekCommentsData) {
    const ctx = document
        .getElementById("lastWeekCommentsChart")
        .getContext("2d");
    const labels = Object.keys(lastWeekCommentsData);
    const data = Object.values(lastWeekCommentsData);

    const lastWeekChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Comments on this date:",
                    data: data,
                    backgroundColor: "rgba(240, 135, 61, 0.5)",
                    borderColor: "rgba(240, 135, 61, 1)",
                    borderWidth: 4,
                    fill: true,
                    tension: 0.4, // Adds slight curve to the line
                },
            ],
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Number of Comments",
                    },
                },
                x: {
                    title: {
                        display: true,
                        text: "Date",
                    },
                },
            },
            plugins: {
                legend: {
                    display: false, // Hide legend since label is descriptive
                },
            },
        },
    });
}