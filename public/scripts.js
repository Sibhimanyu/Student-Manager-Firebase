// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
    getDatabase,
    ref,
    get,
    set,
    push
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-database.js";
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    onAuthStateChanged,
    signOut,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
    closeAllDiv,
    closeModals,
    displayAIContent,
    showNotificationOverlay,
    renderLastWeekCommentsChart,
} from "./modifyUI.js";
import { firebaseConfig, GOOGLE_CHAT_WEBHOOK, GEMINI_API_KEY } from "./config.js";

// Firebase configuration
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

const database = getDatabase(app);
const auth = getAuth(app);
let userEmail = "";
let studentMap = {};

let currentStudentName = "";
let currentStudentID = "";
let originalCommentData = {};
// Define an array of admin emails
const admins = [];
const managers = []; // Add managers array

// Set the current academic year here (update as needed)
const CURRENT_ACADEMIC_YEAR = "2025-26";

// Toggle this variable to enable/disable maintenance mode
const MAINTENANCE_MODE = false; // Set to true to enable maintenance overlay

// Initialize Firebase Authentication
const provider = new GoogleAuthProvider();

async function populateAdminsArray() {
    // Change path to AdminEmails/admins and AdminEmails/managers
    const adminEmailsRef = ref(database, "AdminEmails/admins");
    const managerEmailsRef = ref(database, "AdminEmails/managers");

    try {
        // Admins
        const adminSnap = await get(adminEmailsRef);
        admins.length = 0;
        if (adminSnap.exists()) {
            adminSnap.forEach((childSnapshot) => {
                const email = childSnapshot.val();
                if (email && !admins.includes(email)) {
                    admins.push(email);
                }
            });
        }

        // Managers
        const managerSnap = await get(managerEmailsRef);
        managers.length = 0;
        if (managerSnap.exists()) {
            managerSnap.forEach((childSnapshot) => {
                const email = childSnapshot.val();
                if (email && !managers.includes(email)) {
                    managers.push(email);
                }
            });
        }
    } catch (error) {
        console.error("Error getting data:", error);
    }
}

// Function to handle Google sign-in
function signIn() {
    // Attempt to sign in with a popup
    document.getElementById("loadingOverlay").style.display = "block";
    signInWithPopup(auth, provider)
        .then((result) => {
            const user = result.user;

            // Check if the user's email ends with the allowed domain
            const allowedDomain = "@aurobindovidhyalaya.edu.in";
            if (user.email.endsWith(allowedDomain)) {
                console.log("User signed in:", user);
                document.getElementById("signedOut").style.display = "none";
                document.getElementById("menu_btn").disabled = false;
                document.getElementById("studentDirectory").style.display = "block";
            } else {
                // Sign out the user and display an error message
                document.getElementById("studentDirectory").style.display = "none";
                document.getElementById("modalUserEmail").textContent = "";
                document.getElementById("modalUserName").textContent = "";
                document.getElementById("modalProviderId").textContent = "";
                document.getElementById("userEmail").textContent = "";
                signOut(auth)
                    .then(() => {
                        alert(
                            "Access denied. Only users with an @aurobindovidhyalaya.edu.in email address can sign in."
                        );
                    })
                    .catch((error) => {
                        console.error("Error during sign-out:", error);
                    });
            }
        })
        .catch((error) => {
            console.error("Error during sign-in:", error);

            // Handle specific Firebase Auth error codes
            switch (error.code) {
                case "auth/popup-closed-by-user":
                    alert(
                        "The sign-in popup was closed before completing the sign-in process. Please try again."
                    );
                    break;
                case "auth/popup-blocked":
                    alert(
                        "The sign-in popup was blocked by your browser. Please allow popups for this site and try again."
                    );
                    break;
                case "auth/network-request-failed":
                    alert(
                        "Network error occurred during sign-in. Please check your internet connection and try again."
                    );
                    break;
                case "auth/cancelled-popup-request":
                    alert(
                        "A conflicting sign-in popup request was made. Please wait and try again."
                    );
                    break;
                default:
                    alert(
                        "An unexpected error occurred. Please try again later."
                    );
            }
        })
        .finally(() => {
            document.getElementById("loadingOverlay").style.display = "none";
        });
}

// Function to monitor authentication state
onAuthStateChanged(auth, async (user) => {
    // userEmail = user.email;

    if (user) {
        // Extract user information
        userEmail = user.email;
        const userName = user.displayName || "No name available"; // Fallback if no name
        const userPhotoURL = user.photoURL;
        const providerId = user.providerData[0].providerId; // Provider (e.g., Google, Facebook)

        // Display user information in the modal
        document.getElementById("modalUserEmail").textContent = userEmail;
        document.getElementById("modalUserName").textContent = userName;
        document.getElementById("modalProviderId").textContent = providerId;

        // Display profile picture or initials
        const userPhotoElement = document.getElementById("userEmail");
        if (userPhotoURL) {
            userPhotoElement.innerHTML = `<img src="${userPhotoURL}" alt="User Profile" style="width: 50px; height: 50px; border-radius: 50%;"/>`;
        } else {
            const initials = userName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase();
            userPhotoElement.textContent = initials;
        }

        // Add sign-out functionality
        document
            .getElementById("logoutButton")
            .addEventListener("click", () => {
                closeAllDiv();
                document.getElementById("signedOut").style.display = "block";
                document.getElementById("menu_btn").disabled = true;

                // Display user information in the modal
                document.getElementById("modalUserEmail").textContent = "";
                document.getElementById("modalUserName").textContent = "";
                document.getElementById("modalProviderId").textContent = "";
                document.getElementById("userEmail").textContent = "";

                closeModals();
                signOut(auth)
                    .then(() => {
                        console.log("User signed out.");
                    })
                    .catch((error) => {
                        console.error("Error during logout:", error);
                        alert("Failed to log out. Please try again.");
                    });
            });
        await populateAdminsArray();
        displayStudentSelectBox();
    } else {
        closeAllDiv();
        document.getElementById("signedOut").style.display = "block";
        document.getElementById("menu_btn").disabled = true;
        // User is signed out
        document.getElementById("data-container").innerHTML =
            "Please sign in to view comments.";
    }

    if (admins.includes(userEmail)) {
        document.getElementById("menu_manage_students").style.display = "block";
        document.getElementById("menu_statistics").style.display = "block";
        document.getElementById("menu_all_comments").style.display = "block";
        // Remove settings tab logic
        // if (
        //     userEmail.includes("sibhi@aurobindovidhyalaya.edu.in") ||
        //     userEmail.includes("vineethag@aurobindovidhyalaya.edu.in")
        // ) {
        //     document.getElementById("menu_settings").style.display = "block";
        // }
    } else if (managers.includes(userEmail)) {
        document.getElementById("menu_manage_students").style.display = "block";
        document.getElementById("menu_statistics").style.display = "none";
        document.getElementById("menu_all_comments").style.display = "none";
        
    }
    else {
        document.getElementById("menu_manage_students").style.display = "none";
        document.getElementById("menu_all_comments").style.display = "none";
        document.getElementById("menu_statistics").style.display = "none";
        // document.getElementById("menu_settings").style.display = "none";
    }
});

// ============================
// EDIT STUDENT MODAL
// ============================
function showEditStudentModal(studentId, studentDetails) {
    // Create modal if not exists
    let modal = document.getElementById("editStudentModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "editStudentModal";
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Edit Student</h2>
                    <span id="closeEditStudentModal" class="close-modal" style="cursor:pointer;font-size:20px">&times;</span>
                </div>
                <form id="editStudentForm">
                    <div class="modal-body">
                        <div class="form-row"><label for="edit_first_name">First Name:</label><input type="text" id="edit_first_name" required></div>
                        <div class="form-row"><label for="edit_middle_name">Middle Name:</label><input type="text" id="edit_middle_name"></div>
                        <div class="form-row"><label for="edit_last_name">Last Name:</label><input type="text" id="edit_last_name" required></div>
                        <div class="form-row"><label for="edit_blood_group">Blood Group:</label><input type="text" id="edit_blood_group"></div>
                        <div class="form-row"><label for="edit_class">Class:</label><input type="text" id="edit_class" required></div>
                        <div class="form-row"><label for="edit_section">Section:</label><input type="text" id="edit_section" required></div>
                        <div class="form-row"><label for="edit_date_of_birth">Date of Birth:</label><input type="date" id="edit_date_of_birth" required></div>
                        <div class="form-row"><label for="edit_gender" required >Gender:</label>
                            <select id="edit_gender">
                                <option value="">-</option>
                                <option>MALE</option>
                                <option>FEMALE</option>
                            </select>
                        </div>
                        <div class="form-row"><label for="edit_class_teacher">Class Teacher:</label><input type="text" id="edit_class_teacher"></div>
                        <div class="form-row"><label for="edit_hostel">Hostel Status:</label>
                            <select id="edit_hostel">
                                <option value="">-</option>
                                <option>YES</option>
                                <option>NO</option>
                            </select>
                        </div>
                        <div class="form-row"><label for="edit_mobile">Mobile Number:</label><input type="text" id="edit_mobile"></div>
                        <div class="form-row"><label for="edit_transport_status">Transport Status:</label>
                            <select id="edit_transport_status">
                                <option value="">-</option>
                                <option>SCHOOL TRANSPORT</option>
                                <option>SELF</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="save-button">Save</button>
                        <button type="button" class="cancel-button" id="cancelEditStudentBtn">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById("closeEditStudentModal").onclick = () => { modal.style.display = "none"; };
        document.getElementById("cancelEditStudentBtn").onclick = () => { modal.style.display = "none"; };
    }

    // Fill form fields
    // Fill form fields (safe uppercase)
    document.getElementById("edit_first_name").value = (studentDetails.first_name || "").toUpperCase();
    document.getElementById("edit_middle_name").value = (studentDetails.middle_name || "").toUpperCase();
    document.getElementById("edit_last_name").value = (studentDetails.last_name || "").toUpperCase();
    document.getElementById("edit_blood_group").value = (studentDetails.blood_group || "").toUpperCase();
    document.getElementById("edit_class").value = (studentDetails.class || "").toUpperCase();
    document.getElementById("edit_section").value = (studentDetails.section || "").toUpperCase();

    let dob = studentDetails.date_of_birth || "";
    if (dob && dob.includes("/")) {
        const [dd, mm, yyyy] = dob.split("/");
        dob = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    document.getElementById("edit_date_of_birth").value = dob || "";

    document.getElementById("edit_gender").value = (studentDetails.gender || "").toUpperCase();
    document.getElementById("edit_class_teacher").value = (studentDetails.class_teacher || "").toUpperCase();
    document.getElementById("edit_hostel").value = (studentDetails.hostel || "").toUpperCase();
    document.getElementById("edit_mobile").value = studentDetails.mobile || "";
    document.getElementById("edit_transport_status").value = (studentDetails.transport_status || "").toUpperCase();


    // Submit handler
    document.getElementById("editStudentForm").onsubmit = function (e) {
        e.preventDefault();
        const updated = {
            first_name: document.getElementById("edit_first_name").value.trim().toUpperCase(),
            middle_name: document.getElementById("edit_middle_name").value.trim().toUpperCase(),
            last_name: document.getElementById("edit_last_name").value.trim().toUpperCase(),
            blood_group: document.getElementById("edit_blood_group").value.trim().toUpperCase(),
            class: document.getElementById("edit_class").value.trim().toUpperCase(),
            section: document.getElementById("edit_section").value.trim().toUpperCase(),
            date_of_birth: (() => {
                const val = document.getElementById("edit_date_of_birth").value;
                if (!val) return "";
                const [yyyy, mm, dd] = val.split("-");
                return `${dd}/${mm}/${yyyy}`;
            })(),
            gender: document.getElementById("edit_gender").value.trim().toUpperCase(),
            class_teacher: document.getElementById("edit_class_teacher").value.trim().toUpperCase(),
            hostel: document.getElementById("edit_hostel").value.trim().toUpperCase(),
            mobile: document.getElementById("edit_mobile").value.trim(),
            transport_status: document.getElementById("edit_transport_status").value.toUpperCase(),
        };
        const studentRef = ref(getDatabase(), `Students/${studentId}/details`);
        document.getElementById("loadingOverlay").style.display = "block";
        set(studentRef, updated)
            .then(() => {
                modal.style.display = "none";
                showNotificationOverlay("Student details updated!");
                window.displayStudentTable();
            })
            .catch((err) => alert("Failed to update student: " + err.message))
            .finally(() => {
                document.getElementById("loadingOverlay").style.display = "none";
            });
    };

    modal.style.display = "block";
}

// ============================
// ADD STUDENT MODAL
// ============================
function showAddStudentModal() {
    let modal = document.getElementById("addStudentModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "addStudentModal";
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Add New Student</h2>
                    <span id="closeAddStudentModal" class="close-modal" style="cursor:pointer;font-size:20px">&times;</span>
                </div>
                <form id="addStudentForm">
                    <div class="modal-body">
                        <div class="form-row"><label for="add_first_name">First Name:</label><input type="text" id="add_first_name" required></div>
                        <div class="form-row"><label for="add_middle_name">Middle Name:</label><input type="text" id="add_middle_name"></div>
                        <div class="form-row"><label for="add_last_name">Last Name:</label><input type="text" id="add_last_name" required></div>
                        <div class="form-row"><label for="add_blood_group">Blood Group:</label><input type="text" id="add_blood_group"></div>
                        <div class="form-row"><label for="add_class">Class:</label><input type="text" id="add_class" required></div>
                        <div class="form-row"><label for="add_section">Section:</label><input type="text" id="add_section" required></div>
                        <div class="form-row"><label for="add_date_of_birth">Date of Birth:</label><input type="date" id="add_date_of_birth" required></div>
                        <div class="form-row"><label for="add_gender">Gender:</label>
                            <select id="add_gender" required>
                                <option value="">Select Gender</option>
                                <option>MALE</option>
                                <option>FEMALE</option>
                            </select>
                        </div>
                        <div class="form-row"><label for="add_class_teacher">Class Teacher:</label><input type="text" id="add_class_teacher"></div>
                        <div class="form-row"><label for="add_hostel">Hostel Status:</label>
                            <select id="add_hostel">
                                <option value="">-</option>
                                <option>YES</option>
                                <option>NO</option>
                            </select>
                        </div>
                        <div class="form-row"><label for="add_mobile">Mobile Number:</label><input type="text" id="add_mobile"></div>
                        <div class="form-row"><label for="add_transport_status">Transport Status:</label>
                            <select id="add_transport_status">
                                <option value="">-</option>
                                <option>SCHOOL TRANSPORT</option>
                                <option>SELF</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" class="save-button">Add Student</button>
                        <button type="button" class="cancel-button" id="cancelAddStudentBtn">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById("closeAddStudentModal").onclick = () => { modal.style.display = "none"; };
        document.getElementById("cancelAddStudentBtn").onclick = () => { modal.style.display = "none"; };
    }

    // Reset form
    document.getElementById("addStudentForm").reset();

    // Submit handler
    document.getElementById("addStudentForm").onsubmit = function (e) {
        e.preventDefault();
        const firstName = document.getElementById("add_first_name").value.trim();
        const lastName = document.getElementById("add_last_name").value.trim();
        const studentClass = document.getElementById("add_class").value.trim();
        const section = document.getElementById("add_section").value.trim();
        const dateOfBirth = document.getElementById("add_date_of_birth").value;
        const gender = document.getElementById("add_gender").value;

        if (!firstName || !lastName || !studentClass || !section || !dateOfBirth || !gender) {
            alert("Please fill in all required fields.");
            return;
        }

        const fullName = `${firstName.toUpperCase()} ${document.getElementById("add_middle_name").value.trim().toUpperCase()} ${lastName.toUpperCase()}`.replace(/\s+/g, " ").trim();
        if (studentMap[fullName]) {
            alert("A student with this name already exists.");
            return;
        }

        const newStudent = {
            details: {
                first_name: firstName.toUpperCase(),
                middle_name: document.getElementById("add_middle_name").value.trim().toUpperCase(),
                last_name: lastName.toUpperCase(),
                blood_group: document.getElementById("add_blood_group").value.trim().toUpperCase(),
                class: studentClass.toUpperCase(),
                section: section.toUpperCase(),
                date_of_birth: (() => {
                    const [yyyy, mm, dd] = dateOfBirth.split("-");
                    return `${dd}/${mm}/${yyyy}`;
                })(),
                gender: gender.toUpperCase(),
                class_teacher: document.getElementById("add_class_teacher").value.trim().toUpperCase(),
                hostel: document.getElementById("add_hostel").value.trim().toUpperCase(),
                mobile: document.getElementById("add_mobile").value.trim(),
                transport_status: document.getElementById("add_transport_status").value.toUpperCase(),
            }
        };

        const studentsRef = ref(getDatabase(), "Students");
        document.getElementById("loadingOverlay").style.display = "block";
        const newStudentRef = push(studentsRef);

        set(newStudentRef, newStudent)
            .then(() => {
                modal.style.display = "none";
                showNotificationOverlay("Student added successfully!");
                window.displayStudentTable();
                displayStudentSelectBox();
                studentMap[fullName] = newStudentRef.key;
            })
            .catch((err) => alert("Failed to add student: " + err.message))
            .finally(() => {
                document.getElementById("loadingOverlay").style.display = "none";
            });
    };

    modal.style.display = "block";
}


// Function to open the student management table
window.displayStudentTable = function displayStudentTable() {
    document.getElementById("loadingOverlay").style.display = "block";
    // Hide all interface sections
    const sections = document.querySelectorAll(".interface");
    sections.forEach((section) => (section.style.display = "none"));

    // Display the selected interface
    document.getElementById("manageStudents").style.display = "block";

    // Close the sidebar after selection
    document.getElementById("sidebar").style.width = 0;
    const manageStudentsContainer = document.getElementById("manageStudents");
    manageStudentsContainer.style.display = "block"; // Show the student management interface

    const dbRef = ref(database, "Students");
    get(dbRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const studentsData = snapshot.val();

                // Create Add Student button and insert it before the search container
                const searchContainer = document.querySelector(".search-container");
                let addStudentBtn = document.getElementById("addStudentBtn");
                
                if (!addStudentBtn) {
                    addStudentBtn = document.createElement("button");
                    addStudentBtn.id = "addStudentBtn";
                    addStudentBtn.textContent = "Add New Student";
                    addStudentBtn.style.color = "white";
                    addStudentBtn.style.border = "none";
                    addStudentBtn.style.padding = "10px 20px";
                    addStudentBtn.style.borderRadius = "5px";
                    addStudentBtn.style.cursor = "pointer";
                    addStudentBtn.style.fontSize = "16px";
                    addStudentBtn.style.marginBottom = "15px";
                    addStudentBtn.style.width = "auto";
                    addStudentBtn.style.display = "inline-block";
                    
                    addStudentBtn.addEventListener("click", function() {
                        showAddStudentModal();
                    });
                
                    
                    // Insert before the search container
                    searchContainer.parentNode.insertBefore(addStudentBtn, searchContainer);
                }

                // Build the HTML table
                let tableHTML = `
                <table class="student-table">
                    <thead>
                        <tr>
                            <th>First Name</th>
                            <th>Middle Name</th>
                            <th>Last Name</th>
                            <th>Blood Group</th>
                            <th>Class</th>
                            <th>Section</th>
                            <th>Date of Birth</th>
                            <th>Gender</th>
                            <th>Class Teacher</th>
                            <th>Hostel Status</th>
                            <th>Mobile Number</th>
                            <th>Transport Status</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

                // Populate table rows with student details (display as-is)
                for (const studentId in studentsData) {
                    const student = studentsData[studentId].details;
                    tableHTML += `
                    <tr class="student-row" data-student-id="${studentId}">
                        <td>${student.first_name || "-"}</td>
                        <td>${student.middle_name || "-"}</td>
                        <td>${student.last_name || "-"}</td>
                        <td>${student.blood_group || "-"}</td>
                        <td>${student.class || "-"}</td>
                        <td>${student.section || "-"}</td>
                        <td>${student.date_of_birth || "-"}</td>
                        <td>${student.gender || "-"}</td>
                        <td>${student.class_teacher || "-"}</td>
                        <td>${student.hostel || "-"}</td>
                        <td>${student.mobile || "-"}</td>
                        <td>${student.transport_status || "-"}</td>
                    </tr>
                `;
                }

                tableHTML += `</tbody></table>`;
                document.getElementById("loadingOverlay").style.display = "none";
                document.getElementById("tableContainer").innerHTML = tableHTML;

                // Add click listeners to each row for editing
                document.querySelectorAll(".student-row").forEach((row) => {
                    row.addEventListener("click", function () {
                        const sid = this.getAttribute("data-student-id");
                        const sdetails = studentsData[sid].details;
                        showEditStudentModal(sid, sdetails);
                    });
                });
            } else {
                // Create Add Student button even when no students exist
                const searchContainer = document.querySelector(".search-container");
                let addStudentBtn = document.getElementById("addStudentBtn");
                
                if (!addStudentBtn) {
                    addStudentBtn = document.createElement("button");
                    addStudentBtn.id = "addStudentBtn";
                    addStudentBtn.textContent = "Add New Student";
                    addStudentBtn.style.color = "white";
                    addStudentBtn.style.border = "none";
                    addStudentBtn.style.padding = "10px 20px";
                    addStudentBtn.style.borderRadius = "5px";
                    addStudentBtn.style.cursor = "pointer";
                    addStudentBtn.style.fontSize = "16px";
                    addStudentBtn.style.marginBottom = "15px";
                    addStudentBtn.style.width = "auto";
                    addStudentBtn.style.display = "inline-block";
                    
                    addStudentBtn.addEventListener("click", function() {
                        showAddStudentModal();
                    });
                    
                    // Insert before the search container
                    searchContainer.parentNode.insertBefore(addStudentBtn, searchContainer);
                }
                
                document.getElementById("tableContainer").innerHTML = "<p>No student data available. Click 'Add New Student' to get started.</p>";
            }
        })
        .catch((error) => {
            console.error("Error fetching student data:", error);
            document.getElementById("tableContainer").innerHTML = "<p>Failed to load student data. Please try again later.</p>";
        })
        .finally(() => {
            document.getElementById("loadingOverlay").style.display = "none";
        });
};

window.loadStatistics = function loadStatistics() {
    const loadingText = "loading";
    document
        .querySelectorAll(".stat-number")
        .forEach((elem) => (elem.innerHTML = loadingText));
    const sections = document.querySelectorAll(".interface");
    sections.forEach((section) => (section.style.display = "none"));

    // Display the selected interface
    document.getElementById("statistics").style.display = "block";
    const dbRef = ref(database, "Students");

    get(dbRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const studentsData = snapshot.val();
                let totalStudents = 0;
                let totalComments = 0;
                let todaysComments = 0;
                let lastWeekCommentsData = {};

                const today = new Date();
                const todayString = `${String(today.getDate()).padStart(
                    2,
                    "0"
                )}/${String(today.getMonth() + 1).padStart(
                    2,
                    "0"
                )}/${today.getFullYear()}`;

                // Initialize last week's date labels and set counts to zero
                for (let i = 30; i >= 0; i--) {
                    const date = new Date(today);
                    date.setDate(today.getDate() - i);
                    const dateString = `${String(date.getDate()).padStart(
                        2,
                        "0"
                    )}/${String(date.getMonth() + 1).padStart(
                        2,
                        "0"
                    )}/${date.getFullYear()}`;
                    lastWeekCommentsData[dateString] = 0; // Default to 0 comments initially
                }

                // Calculate statistics
                for (const studentId in studentsData) {
                    totalStudents++; // Count total students
                    const studentCommentsByYear = studentsData[studentId].comments;

                    if (studentCommentsByYear) {
                        // Loop through each year under comments
                        Object.keys(studentCommentsByYear).forEach((yearKey) => {
                            const studentComments = studentCommentsByYear[yearKey];
                            if (studentComments) {
                                Object.keys(studentComments).forEach((commentKey) => {
                                    const comment = studentComments[commentKey];
                                    totalComments++; // Count total comments

                                    // Check if the comment was made today
                                    if (comment.date === todayString) {
                                        todaysComments++;
                                    }

                                    // Check if the comment was made in the past week and count per day
                                    if (
                                        lastWeekCommentsData.hasOwnProperty(
                                            comment.date
                                        )
                                    ) {
                                        lastWeekCommentsData[comment.date]++;
                                    }
                                });
                            }
                        });
                    }
                }

                const avgComments =
                    totalStudents > 0
                        ? (totalComments / totalStudents).toFixed(2)
                        : 0;

                // Update the Statistics with calculated statistics
                updateStatWithAnimation("total-students", totalStudents);
                updateStatWithAnimation("total-comments", totalComments);
                updateStatWithAnimation("comments-today", todaysComments);
                updateStatWithAnimation("avg-comments", avgComments);

                // Render line chart for last week's comments
                renderLastWeekCommentsChart(lastWeekCommentsData);
            } else {
                console.log("No data available");
            }
        })
        .catch((error) => {
            console.error("Error fetching data:", error);
        });
    document.getElementById("sidebar").style.width = 0;
};

function updateStatWithAnimation(elementId, value) {
    const element = document.getElementById(elementId);
    element.innerHTML = value;
    element.classList.add("fade-in");

    // Remove the animation class after it finishes to allow re-animation on next update
    setTimeout(() => {
        element.classList.remove("fade-in");
    }, 1000);
}

async function generateContent(inputText) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    var payload = {
        contents: [
            {
                role: "user",
                parts: [
                    {
                        text: 'AADHAVANN S\n{"date":"10/08/2023","time":"12:22:18 PM","from":"akilas@aurobindovidhyalaya.edu.in","comment":"Mother said he got food poisoning so two days leave, academic wise he is doing good reading, and writing part, he is not healthy so only he talked like need of tc. She said don\'\'\'t take that TC to as a serious matter he himself talked. "}\n{"date":"06/08/2024","time":"12:23:14 PM","from":"akilas@aurobindovidhyalaya.edu.in","comment":" He is good, everything going well."}\n{"date":"06/08/2024","time":"12:25:52 PM","from":"akilas@aurobindovidhyalaya.edu.in","comment":"Everything going well"}\n{"date":"09/08/2024","time":"10:26:26 AM","from":"akilas@aurobindovidhyalaya.edu.in","comment":"In pervious school this school is good"}\n',
                    },
                ],
            },
            {
                role: "model",
                parts: [
                    {
                        text: "* Student had food poisoning and took two days of leave.\n* Shows improvement in reading and writing.\n* Request for TC was due to illness and should not be taken seriously.\n* Overall good progress and positive feedback about the school.",
                    },
                ],
            },
            {
                role: "user",
                parts: [
                    {
                        text: inputText,
                    },
                ],
            },
        ],
        systemInstruction: {
            role: "user",
            parts: [
                {
                    text: "Provide bullet points\nKeep it short and sweet\nSummarize the student comments\nThe bullet points should not be based on time\nMinimum number of bullet points but all info should be displayed",
                },
            ],
        },
        generationConfig: {
            temperature: 1,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: "text/plain",
        },
    };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json(); // Directly parse JSON
        const specificText = result.candidates[0].content.parts[0].text; // Access the specific value

        displayAIContent(specificText);
        return specificText;
    } catch (error) {
        console.error("Error:", error);
    }
}

// Function to fetch and display student data in the select box
function displayStudentSelectBox() {
    const dbRef = ref(database, "Students");
    const selectBox = document.getElementById("studentList");
    const getBtn = document.getElementById("getCommentsBtn");
    const textBox = document.getElementById("student-select");

    // Clear existing options
    selectBox.innerHTML = "";

    get(dbRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();

                // Loop through students and add them to the dropdown immediately
                for (const studentId in data) {
                    const studentData = data[studentId];
                    // Build student name as-is (no uppercase)
                    const studentName = `${
                        studentData.details?.first_name ?? ""
                    } ${studentData.details?.middle_name ?? ""} ${
                        studentData.details?.last_name ?? ""
                    }`
                        .replace(/\s+/g, " ")
                        .trim();
                    const date_of_birth = studentData.details.date_of_birth;
                    const grade_section = studentData.details.class + "-" + studentData.details.section;
                    
                    studentMap[studentName] = studentId;

                    const option = document.createElement("option");
                    option.value = studentName; // Store the student name as value (as-is)
                    option.textContent = grade_section + "\n (" + date_of_birth + ")"; // Display DOB and Grade/Section
                    selectBox.appendChild(option);
                }

                // Event listener for button click
                getBtn.addEventListener("click", function () {
                    const selectedStudent = textBox.value;
                    if (selectedStudent) {
                        currentStudentName = selectedStudent;
                        currentStudentID =
                            getStudentIdByName(currentStudentName);
                        if (currentStudentID) {
                            displayStudentData(currentStudentID); // Pass selected student's ID
                        } else {
                            document.getElementById(
                                "addCommentButton"
                            ).disabled = true;
                            alert("Student could not be found in Database");
                            document.getElementById(
                                "data-container"
                            ).innerHTML =
                                "Student could not be found in Database";
                        }
                    }
                });
            } else {
                console.log("No data available");
            }
        })
        .catch((error) => {
            console.error("Error fetching data:", error);
        });
}

function getStudentIdByName(studentName) {
    // Use as-is for lookup
    return studentMap[studentName] || null;
}

// Modify displayStudentData function
function displayStudentData(currentStudentID) {
    displayAIContent("Loading");
    document.getElementById("loadingOverlay").style.display = "block";
    document.getElementById("addCommentButton").disabled = true;

    const dbRef = ref(database, `Students/${currentStudentID}/comments`);
    const user = auth.currentUser; // Get the currently signed-in user
    const userEmail = user ? user.email : null; // Get the user's email

    get(dbRef)
        .then((snapshot) => {
            const dataContainer = document.getElementById("data-container");
            dataContainer.innerHTML = ""; // Clear previous data

            if (snapshot.exists()) {
                const commentsByYear = snapshot.val();
                let displayedComments = [];

                // Sort years in reverse chronological order
                const sortedYears = Object.keys(commentsByYear).sort((a, b) => b.localeCompare(a));

                // Iterate over each year and fetch comments
                sortedYears.forEach((year) => {
                    const comments = commentsByYear[year];

                    if (
                        comments &&
                        typeof comments === "object" &&
                        Object.keys(comments).length > 0
                    ) {
                        // Add a heading for the year
                        const yearHeading = document.createElement("h3");
                        yearHeading.className = "year-heading";
                        yearHeading.textContent = `Year: ${year}`;
                        dataContainer.appendChild(yearHeading);

                        // Sort comments within the year by date and time in reverse order
                        const sortedComments = Object.keys(comments).sort((a, b) => {
                            const dateA = new Date(
                                `${comments[a].date.split("/").reverse().join("-")} ${comments[a].time}`
                            );
                            const dateB = new Date(
                                `${comments[b].date.split("/").reverse().join("-")} ${comments[b].time}`
                            );
                            return dateB - dateA;
                        });

                        sortedComments.forEach((key) => {
                            const comment = comments[key];

                            // Show comment if it's from the user, or user is admin/manager
                            if (
                                comment.from === userEmail ||
                                admins.includes(userEmail) ||
                                managers.includes(userEmail)
                            ) {
                                const commentBox = document.createElement("div");
                                commentBox.className = "comment-box";
                                commentBox.innerHTML = `
                                    <p class="from-text">${comment.from}</p>
                                    <p class="comment-date">${comment.date} ${comment.time}</p>
                                    <p class="comment-text">${comment.comment}</p>
                                `;

                                displayedComments.push({
                                    date: comment.date,
                                    time: comment.time,
                                    from: comment.from,
                                    comment: comment.comment,
                                    year: year,
                                });

                                // --- Notes Section ---
                                const notesContainer = document.createElement("div");
                                notesContainer.className = "notes-container";
                                notesContainer.style.marginTop = "10px";
                                commentBox.appendChild(notesContainer);

                                // Load notes for this comment
                                loadNotesForComment(currentStudentID, year, key, notesContainer);

                                // --- End Notes Section ---

                                // Determine edit permission
                                let canEdit = false;
                                if (year === CURRENT_ACADEMIC_YEAR && admins.includes(userEmail)) {
                                    canEdit = true;
                                }

                                // Click handler for comment box
                                commentBox.onclick = function (e) {
                                    e.stopPropagation();
                                    // Allow add note for all years, but only allow edit/delete for current year
                                    openCommentActionModal(currentStudentID, key, year, canEdit, notesContainer);
                                };

                                // Style for managers and non-admins (current year)
                                if (year === CURRENT_ACADEMIC_YEAR && managers.includes(userEmail)) {
                                    commentBox.title = "Managers can view all comments but cannot edit or delete.";
                                    commentBox.style.opacity = "1";
                                    commentBox.style.cursor = "pointer";
                                } else if (year === CURRENT_ACADEMIC_YEAR && !admins.includes(userEmail)) {
                                    commentBox.title = "Only admins can edit or delete comments.";
                                    commentBox.style.opacity = "0.7";
                                    commentBox.style.cursor = "pointer";
                                } else if (year !== CURRENT_ACADEMIC_YEAR) {
                                    commentBox.title = "You can add notes to comments from previous years.";
                                    commentBox.style.opacity = "0.7";
                                    commentBox.style.cursor = "pointer";
                                }

                                dataContainer.appendChild(commentBox);
                            }
                        });
                    }
                });

                if (displayedComments.length === 0) {
                    dataContainer.innerHTML =
                        "You have not added any comments for this student.";
                }
                generateContent(JSON.stringify(displayedComments));
            } else {
                dataContainer.innerHTML =
                    "No comments available for this student.";
            }
            document.getElementById("loadingOverlay").style.display = "none";
            document.getElementById("addCommentButton").disabled = false;
        })
        .catch((error) => {
            console.error("Error fetching data:", error);
            document.getElementById("loadingOverlay").style.display = "none";
        });
}

// --- Add: Modal for choosing Edit or Add Note ---
function openCommentActionModal(studentID, commentKey, year, canEdit, notesContainer) {
    // Create modal if not exists
    let modal = document.getElementById("commentActionModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "commentActionModal";
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header">
                    <h2>Comment Action</h2>
                    <span id="closeCommentActionModal" class="close-modal" style="cursor:pointer;font-size:20px">&times;</span>
                </div>
                <div class="modal-body" id="commentActionModalBody"></div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById("closeCommentActionModal").onclick = closeModals;
    }

    // Set modal body
    const body = modal.querySelector("#commentActionModalBody");
    body.innerHTML = "";
    if (canEdit) {
        // Show both options
        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit Comment";
        editBtn.onclick = function () {
            closeModals();
            openEditModal(studentID, commentKey, year);
        };
        const noteBtn = document.createElement("button");
        noteBtn.textContent = "Add Note";
        noteBtn.onclick = function () {
            closeModals();
            addNoteToComment(studentID, year, commentKey, notesContainer);
        };
        body.appendChild(editBtn);
        body.appendChild(noteBtn);
    } else {
        // Always allow add note, even for previous years
        const noteBtn = document.createElement("button");
        noteBtn.textContent = "Add Note";
        noteBtn.onclick = function () {
            closeModals();
            addNoteToComment(studentID, year, commentKey, notesContainer);
        };
        body.appendChild(noteBtn);
    }
    modal.style.display = "block";
}

// --- Add: Notes Section ---
function loadNotesForComment(studentID, year, commentKey, notesContainer) {
    const notesRef = ref(database, `Students/${studentID}/comments/${year}/${commentKey}/notes`);
    get(notesRef)
        .then((snapshot) => {
            // Remove previous notes-list content if any
            notesContainer.innerHTML = "";
            if (snapshot.exists()) {
                const notes = snapshot.val();
                const noteKeys = Object.keys(notes);
                if (noteKeys.length > 0) {
                    // Improved notes presentation
                    let notesHtml = `
                        <div class="notes-block">
                            <div class="notes-title"><span>Notes</span></div>
                            <div class="notes-list">
                    `;
                    noteKeys
                        .sort((a, b) => {
                            // Sort by date and time if available, fallback to insertion order
                            const noteA = notes[a];
                            const noteB = notes[b];
                            const dateA = noteA.date || "";
                            const dateB = noteB.date || "";
                            const timeA = noteA.time || "";
                            const timeB = noteB.time || "";
                            // Compare date first, then time
                            if (dateA !== dateB) {
                                return dateA > dateB ? 1 : -1;
                            }
                            return timeA > timeB ? 1 : -1;
                        })
                        .forEach((noteKey) => {
                            const note = notes[noteKey];
                            notesHtml += `
                                <div class="note-item">
                                    <div class="note-header">
                                        <span class="note-author">${note.by || "Unknown"}</span>
                                        <span class="note-date">
                                            ${note.date ? note.date : ""}
                                            ${note.time ? note.time : ""}
                                        </span>
                                    </div>
                                    <div class="note-text">${note.text}</div>
                                </div>
                            `;
                        });
                    notesHtml += `
                            </div>
                        </div>
                    `;
                    notesContainer.innerHTML = notesHtml;
                }
                // If no notes, leave notesContainer empty (no "Notes:" label)
            }
            // If no notes, leave notesContainer empty (no "Notes:" label)
        })
        .catch((error) => {
            notesContainer.innerHTML = "<span style='color:red;'>Failed to load notes.</span>";
        });
}

// Add a note to a comment
function addNoteToComment(studentID, year, commentKey, notesContainer) {
    // Create modal if not exists
    let modal = document.getElementById("addNoteModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "addNoteModal";
        modal.className = "modal";
        modal.innerHTML = `
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header">
                    <h2>Add Note</h2>
                    <span id="closeAddNoteModal" class="close-modal" style="cursor:pointer;font-size:20px">&times;</span>
                </div>
                <form id="addNoteForm">
                    <label>Note:<br>
                        <textarea id="addNoteText" rows="3" style="width:100%;" required></textarea>
                    </label><br>
                    <label>Date:
                        <input type="date" id="addNoteDate" required>
                    </label><br>
                    <div class="modal-footer">
                        <button type="submit" class="save-button">Add Note</button>
                        <button type="button" class="cancel-button" id="cancelAddNoteBtn">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById("closeAddNoteModal").onclick = () => { modal.style.display = "none"; };
        document.getElementById("cancelAddNoteBtn").onclick = () => { modal.style.display = "none"; };
    }

    // Set default date to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    document.getElementById("addNoteDate").value = `${yyyy}-${mm}-${dd}`;
    document.getElementById("addNoteText").value = "";

    document.getElementById("addNoteForm").onsubmit = function (e) {
        e.preventDefault();
        const noteText = document.getElementById("addNoteText").value.trim();
        const noteDateInput = document.getElementById("addNoteDate").value;

        if (!noteText || !noteDateInput) return;

        // Convert YYYY-MM-DD to DD/MM/YYYY
        const [y, m, d] = noteDateInput.split("-");
        const noteDate = `${d}/${m}/${y}`;

        // Get current time in hh:mm:ss AM/PM format
        let now = new Date();
        let hours = now.getHours();
        let minutes = String(now.getMinutes()).padStart(2, "0");
        let seconds = String(now.getSeconds()).padStart(2, "0");
        let ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        let timeStr = `${String(hours).padStart(2, "0")}:${minutes}:${seconds} ${ampm}`;

        const user = auth.currentUser;
        const userEmail = user ? user.email : "Unknown";
        const noteObj = {
            text: noteText,
            by: userEmail,
            date: noteDate,
            time: timeStr
        };

        const notesRef = ref(database, `Students/${studentID}/comments/${year}/${commentKey}/notes`);
        const newNoteRef = push(notesRef);
        set(newNoteRef, noteObj)
            .then(() => {
                modal.style.display = "none";
                loadNotesForComment(studentID, year, commentKey, notesContainer);
            })
            .catch((error) => {
                alert("Failed to add note: " + error.message);
            });
    };

    modal.style.display = "block";
}

window.displayAllStudentData = function displayAllStudentData() {
    closeAllDiv();
    document.getElementById("sidebar").style.width = "0";
    document.getElementById("loadingOverlay").style.display = "block";
    document.getElementById("allComments").style.display = "block";

    const dbRef = ref(database, `Students`);
    const dataContainer = document.getElementById("allCommentsListContainer");
    dataContainer.innerHTML = ""; // Clear previous data

    let allComments = [];
    let allEmailsSet = new Set();
    let displayedCount = 0;
    // const batchSize = 10; // Remove batchSize, not needed
    let currentEmailFilter = "All";

    // --- Update: Render all comments at once, remove extra container ---
    function renderComments() {
        // Filter comments by selected email
        let filteredComments = allComments;
        if (currentEmailFilter !== "All") {
            filteredComments = allComments.filter(
                (c) => c.from === currentEmailFilter
            );
        }

        // Remove any inner wrapper or message
        dataContainer.innerHTML = "";

        filteredComments.forEach((comment) => {
            const commentBox = document.createElement("div");
            commentBox.className = "comment-box";
            commentBox.innerHTML = `
                <p class="student-name">${comment.name}</p>
                <p class="student-class">${comment.class} - ${comment.section}</p>
                <p class="from-text">${comment.from}</p>
                <p class="comment-date">${comment.date} ${comment.time}</p>
                <p class="comment-text">${comment.comment}</p>
            `;

            commentBox.addEventListener("click", function () {
                openEditModal(comment.studentID, comment.key, comment.year);
            });

            dataContainer.appendChild(commentBox);
        });

        displayedCount = filteredComments.length;

        // If no comments, show message (no wrapper div)
        if (filteredComments.length === 0) {
            dataContainer.textContent = "No comments available for this user.";
        }
    }
    // --- End update ---

    // Helper to render the select box
    function renderEmailFilterSelect(emails) {
        // Remove existing filter if present
        const existing = document.getElementById("userEmailFilterSelect");
        if (existing) existing.remove();

        const select = document.createElement("select");
        select.id = "userEmailFilterSelect";
        select.style.marginBottom = "12px";
        select.style.display = "block";

        // Add "All" option
        const allOption = document.createElement("option");
        allOption.value = "All";
        allOption.textContent = "All Users";
        select.appendChild(allOption);

        // Add email options
        emails.forEach(email => {
            const option = document.createElement("option");
            option.value = email;
            option.textContent = email;
            select.appendChild(option);
        });

        // Insert at the top of the container
        dataContainer.parentNode.insertBefore(select, dataContainer);

        // Listen for changes
        select.addEventListener("change", function () {
            currentEmailFilter = this.value;
            displayedCount = 0;
            dataContainer.innerHTML = "";
            renderComments();
        });
    }

    get(dbRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const students = snapshot.val();

                Object.keys(students).forEach((studentID) => {
                    const student = students[studentID];

                    if (
                        student.comments &&
                        typeof student.comments === "object"
                    ) {
                        // Iterate over each year under comments
                        Object.keys(student.comments).forEach((yearKey) => {
                            const yearComments = student.comments[yearKey];
                            if (
                                yearComments &&
                                typeof yearComments === "object"
                            ) {
                                Object.keys(yearComments).forEach((key) => {
                                    const comment = yearComments[key];
                                    // Build student name as-is
                                    const studentName = `${
                                        student.details?.first_name ?? ""
                                    } ${student.details?.middle_name ?? ""} ${
                                        student.details?.last_name ?? ""
                                    }`
                                        .replace(/\s+/g, " ")
                                        .trim();

                                    allComments.push({
                                        studentID: studentID,
                                        name: studentName,
                                        class: student.details.class || "",
                                        section: student.details.section || "",
                                        date: comment.date,
                                        time: comment.time,
                                        from: comment.from,
                                        comment: comment.comment,
                                        key: key,
                                        year: yearKey,
                                    });

                                    // --- Add: Collect unique emails ---
                                    if (comment.from) {
                                        allEmailsSet.add(comment.from);
                                    }
                                    // --- End Add ---
                                });
                            }
                        });
                    }
                });

                // --- Add: Render the select box with all emails ---
                const allEmails = Array.from(allEmailsSet).sort();
                renderEmailFilterSelect(allEmails);
                // --- End Add ---

                allComments.sort((a, b) => {
                    // Sort by date and time, most recent first
                    const dateA = new Date(
                        a.date.split("/").reverse().join("-") + " " + a.time
                    );
                    const dateB = new Date(
                        b.date.split("/").reverse().join("-") + " " + b.time
                    );
                    return dateB - dateA;
                });

                renderComments();

                // --- Remove scrollListener: no infinite scroll needed ---
                // ...existing code...
                // --- End remove ---

                // If no comments at all
                if (allComments.length === 0) {
                    dataContainer.innerHTML =
                        "No comments available for any student.";
                }
            } else {
                dataContainer.innerHTML = "No students or comments available.";
            }

            document.getElementById("loadingOverlay").style.display = "none";
        })
        .catch((error) => {
            console.error("Error fetching data:", error);
            document.getElementById("loadingOverlay").style.display = "none";
        });
};

// Remove displayCurrentUserComments function and all references to it

function submitNewComment() {
    document.getElementById("loadingOverlay").style.display = "block";
    const commentText = document.getElementById("addCommentText").value.trim();
    var commentDate = document.getElementById("commentDate").value;

    let commentDateObj;

    if (!commentDate) {
        commentDateObj = new Date();
    } else {
        commentDateObj = new Date(document.getElementById("commentDate").value);
    }

    const day = String(commentDateObj.getDate()).padStart(2, "0");
    const month = String(commentDateObj.getMonth() + 1).padStart(2, "0"); // Months are zero-indexed
    const year = commentDateObj.getFullYear();

    commentDate = `${day}/${month}/${year}`;

    if (!commentText || !commentDate) {
        alert("Please fill in both the comment and the date.");
        document.getElementById("loadingOverlay").style.display = "none";
        return;
    }

    // Create the comment object
    const newComment = {
        comment: commentText,
        date: commentDate,
        from: userEmail, // Replace with actual email or user identification
        time: new Date().toLocaleTimeString(),
    };

    // Use push() to generate a unique key for the comment under the correct path
    const commentsRef = ref(database, `Students/${currentStudentID}/comments/2025-26`);
    const newCommentRef = push(commentsRef); // This generates a unique key for the comment
    set(newCommentRef, newComment)
        .then(() => {
            console.log("Comment added successfully!");
            closeModals(); // Close the modal after saving
            displayStudentData(currentStudentID); // Refresh the comments display

            // Send notification to Google Chat
            sendGoogleChatNotification(newComment, "New Comment Added");
            showNotificationOverlay("Comment Added Successfully");
        })
        .catch((error) => {
            console.error("Error adding comment:", error);
            alert("Failed to add comment. Please try again.");
        });
    document.getElementById("loadingOverlay").style.display = "none";
}

// Function to send a notification to Google Chat
function sendGoogleChatNotification(comment, messageReason) {
    const webhookUrl = GOOGLE_CHAT_WEBHOOK;
    const message = {
        text: `${messageReason}\nBy: ${comment.from}\nDate: ${comment.date}\nComment: "${comment.comment}"`,
    };

    // Send the message to the Google Chat webhook
    fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
    })
        .then((response) => {
            if (response.ok) {
                console.log("Notification sent to Google Chat successfully.");
            } else {
                console.error(
                    "Failed to send notification to Google Chat:",
                    response.statusText
                );
            }
        })
        .catch((error) => {
            console.error("Error sending notification to Google Chat:", error);
        });
}

// Function to open the edit comment modal
function openEditModal(studentID, commentKey, year) {
    // Prevent editing if not current year
    if (year !== CURRENT_ACADEMIC_YEAR) {
        alert("You cannot edit or delete comments from previous years.");
        return;
    }

    document
        .getElementById("saveEditCommentButton")
        .onclick = function () {
            saveComment(studentID, commentKey, year);
        };
    document
        .getElementById("deleteCommentButton")
        .onclick = function () {
            deleteComment(studentID, commentKey, year);
        };

    const commentRef = ref(
        database,
        `Students/${studentID}/comments/${year}/${commentKey}`
    );
    get(commentRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                originalCommentData = snapshot.val(); // Store the original comment data
                document.getElementById("editCommentText").value =
                    originalCommentData.comment;
                document.getElementById("editModal").style.display = "block"; // Show the modal
            } else {
                console.error("No comment data available for editing.");
            }
        })
        .catch((error) => {
            console.error("Error fetching comment data:", error);
        });
}

// Function to save the edited comment
function saveComment(studentID, commentKey, year) {
    // Prevent saving if not current year
    if (year !== CURRENT_ACADEMIC_YEAR) {
        alert("You cannot edit comments from previous years.");
        closeModals();
        return;
    }

    document.getElementById("loadingOverlay").style.display = "block";

    const updatedCommentText = document
        .getElementById("editCommentText")
        .value.trim();

    if (!updatedCommentText) {
        alert("Comment cannot be empty.");
        return;
    }

    const commentRef = ref(
        database,
        `Students/${studentID}/comments/${year}/${commentKey}`
    );

    // Fetch the existing comment to preserve notes
    get(commentRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const existingData = snapshot.val();
                // Preserve notes if present
                const updatedData = {
                    comment: updatedCommentText,
                    date: originalCommentData.date, // Retain original date
                    time: originalCommentData.time, // Retain original time
                    from: originalCommentData.from, // Retain original email
                };
                if (existingData.notes) {
                    updatedData.notes = existingData.notes;
                }
                return set(commentRef, updatedData);
            } else {
                throw new Error("No comment data available for editing.");
            }
        })
        .then(() => {
            console.log("Comment updated successfully!");
            closeModals();
            displayStudentData(studentID); // Refresh the comments display
        })
        .catch((error) => {
            console.error("Error updating comment:", error);
            alert("Failed to update comment. Please try again.");
        })
        .finally(() => {
            document.getElementById("loadingOverlay").style.display = "none";
            showNotificationOverlay("Comment Updated Successfully");
        });
}

// Function to delete a comment
function deleteComment(studentID, commentKey, year) {
    // Prevent deleting if not current year
    if (year !== CURRENT_ACADEMIC_YEAR) {
        alert("You cannot delete comments from previous years.");
        closeModals();
        return;
    }

    document.getElementById("loadingOverlay").style.display = "block";

    // Reference to the comment
    const commentRef = ref(
        database,
        `Students/${studentID}/comments/${year}/${commentKey}`
    );

    // Retrieve the comment data before deletion to include it in the notification
    get(commentRef)
        .then((snapshot) => {
            if (snapshot.exists()) {
                const commentData = snapshot.val(); // Get the comment details

                // Delete the comment
                return set(commentRef, null).then(() => {
                    console.log("Comment deleted successfully!");
                    sendGoogleChatNotification(commentData, "Comment Deleted"); // Notify Google Chat
                    closeModals();
                    displayStudentData(studentID); // Refresh the comments display

                    // --- Remove refresh "Your Comments" tab if visible ---
                    // if (
                    //     document.getElementById("commentsByUser").style.display === "block"
                    // ) {
                    //     window.displayCurrentUserComments();
                    // }
                    // --- End remove ---
                });
            } else {
                throw new Error("Comment does not exist.");
            }
        })
        .catch((error) => {
            console.error("Error deleting comment:", error);
            alert("Failed to delete comment. Please try again.");
        })
        .finally(() => {
            document.getElementById("loadingOverlay").style.display = "none";
            showNotificationOverlay("Comment Deleted Successfully");
        });
}

// Set up event listeners when the page loads
window.addEventListener("DOMContentLoaded", () => {
    // --- Maintenance Overlay ---
    if (MAINTENANCE_MODE) {
        // Create overlay
        const overlay = document.createElement("div");
        overlay.id = "maintenanceOverlay";
        overlay.innerHTML = `
            <div class="maintenance-message">
                <h2>Website Under Maintenance</h2>
                <p>This website is currently undergoing maintenance.<br>
                Please contact <a href="mailto:sibhi@aurobindovidhyalaya.edu.in">sibhi@aurobindovidhyalaya.edu.in</a> for any information.</p>
            </div>
        `;
        document.body.appendChild(overlay);

        // Prevent interaction with the rest of the page
        overlay.style.display = "flex";
        overlay.style.position = "fixed";
        overlay.style.top = 0;
        overlay.style.left = 0;
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.background = "rgba(30,30,30,0.95)";
        overlay.style.zIndex = 20000;
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        overlay.style.flexDirection = "column";
        overlay.querySelector(".maintenance-message").style.background = "#fff";
        overlay.querySelector(".maintenance-message").style.padding = "40px 30px";
        overlay.querySelector(".maintenance-message").style.borderRadius = "12px";
        overlay.querySelector(".maintenance-message").style.boxShadow = "0 4px 24px rgba(0,0,0,0.2)";
        overlay.querySelector(".maintenance-message").style.textAlign = "center";
        overlay.querySelector(".maintenance-message h2").style.color = "#f0873d";
        overlay.querySelector(".maintenance-message a").style.color = "#f0873d";
        // Stop further JS execution
        return;
    }
    // --- End Maintenance Overlay ---

    // Add event listeners for modal actions
    document
        .getElementById("addCommentButton")
        .addEventListener("click", function () {
            document.getElementById("addModal").style.display = "block";
        });
    document
        .getElementById("closeModal")
        .addEventListener("click", closeModals);
    document
        .getElementById("closeModal2")
        .addEventListener("click", closeModals);
    document
        .getElementById("closeModal1")
        .addEventListener("click", closeModals);
    document.getElementById("signInButton").addEventListener("click", signIn);
    document
        .getElementById("saveCommentButton")
        .addEventListener("click", submitNewComment);

    document
        .getElementById("menu_logout")
        .addEventListener("click", function () {
            closeAllDiv();
            document.getElementById("signedOut").style.display = "block";
            document.getElementById("menu_btn").disabled = true;

            // Display user information in the modal
            document.getElementById("modalUserEmail").textContent = "";
            document.getElementById("modalUserName").textContent = "";
            document.getElementById("modalProviderId").textContent = "";
            document.getElementById("userEmail").textContent = "";

            closeModals();
            signOut(auth)
                .then(() => {
                    console.log("User signed out.");
                })
                .catch((error) => {
                    console.error("Error during logout:", error);
                    alert("Failed to log out. Please try again.");
                });
        });

    // Open the user modal when the user circle is clicked
    document
        .querySelector(".user-circle")
        .addEventListener("click", function () {
            const modal = document.getElementById("userModal");
            modal.style.display = "block"; // Show the modal
        });

    window.addEventListener("click", function (event) {
        const modals = ["editModal", "userModal", "addModal"];
        const sidebar = document.getElementById("sidebar");
        const menuButton = document.getElementById("menu_btn");

        // Check if click is on modals
        modals.forEach((modalId) => {
            const modal = document.getElementById(modalId);
            if (event.target === modal) {
                closeModals();
            }
        });
        // alert(typeof(document.getElementById("sidebar").style.width));

        // Check if click is outside the sidebar or the menu button
        if (
            !sidebar.contains(event.target) &&
            event.target !== menuButton &&
            document.getElementById("sidebar").style.width == "250px"
        ) {
            closeModals();
        }
    });

    // Monitor the authentication state
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            console.log("User is already logged in:", user);
        } else {
            // User is not signed in, trigger sign-in
            console.log("No user is logged in. Redirecting to sign-in...");
            closeAllDiv();
            document.getElementById("signedOut").style.display = "block";
            document.getElementById("menu_btn").disabled = true;
        }
    });
    document.getElementById("studentDirectory").style.display = "block"; // Show the modal

});