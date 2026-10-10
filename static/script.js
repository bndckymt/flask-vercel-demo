
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const totalElement = document.getElementById("total");
const completedElement = document.getElementById("completed");
const progressText = document.getElementById("progress-text");
const progressFill = document.getElementById("progress-fill");
const taskCount = document.getElementById("task-count");
const clearCompletedButton = document.getElementById("clear-completed");

let tasks = [];

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        ...options
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

async function loadTasks() {
    try {
        tasks = await apiRequest("/api/tasks");
        renderTasks();
    } catch (error) {
        alert(error.message);
    }
}

function renderTasks() {
    taskList.replaceChildren();

    tasks.forEach(task => {
        const item = document.createElement("div");
        item.className = "task-item" +
            (task.completed ? " is-complete" : "");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "task-check";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", `Complete ${task.title}`);

        checkbox.addEventListener("change", async () => {
            try {
                await apiRequest(`/api/tasks/${task.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                        completed: checkbox.checked
                    })
                });
                await loadTasks();
            } catch (error) {
                alert(error.message);
            }
        });

        const title = document.createElement("span");
        title.className = "task-title";
        title.textContent = task.title;

        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-button";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", async () => {
            try {
                await apiRequest(`/api/tasks/${task.id}`, {
                    method: "DELETE"
                });
                await loadTasks();
            } catch (error) {
                alert(error.message);
            }
        });

        item.append(checkbox, title, deleteButton);
        taskList.appendChild(item);
    });

    const completed = tasks.filter(task => task.completed).length;
    const percentage = tasks.length
        ? Math.round(completed / tasks.length * 100)
        : 0;

    totalElement.textContent = tasks.length;
    completedElement.textContent = completed;
    progressText.textContent = `${percentage}%`;
    progressFill.style.width = `${percentage}%`;

    taskCount.textContent = `${tasks.length} ${
        tasks.length === 1 ? "task" : "tasks"
    }`;

    emptyState.hidden = tasks.length > 0;
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    const title = input.value.trim();
    if (!title) return;

    try {
        await apiRequest("/api/tasks", {
            method: "POST",
            body: JSON.stringify({ title })
        });

        input.value = "";
        await loadTasks();
        input.focus();
    } catch (error) {
        alert(error.message);
    }
});

clearCompletedButton.addEventListener("click", async () => {
    try {
        await apiRequest("/api/tasks/completed", {
            method: "DELETE"
        });
        await loadTasks();
    } catch (error) {
        alert(error.message);
    }
});

loadTasks();
