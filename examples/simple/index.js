const {ConsoleBrowser, ServerApp, InputForm} = require('../../');

const students = ['First', 'Second', 'Third'];

const app = new ServerApp();

app.use("/", (req, res) => {
    const links = {
        "f": "Form sample", 
        "f2": "Form sample many fields", 
        "f3": "Form sample many fields with default and value", 
        "n": "Just a state", 
        "e": "No handler error",
        "t": "Response timeout", 
        "r": "Redirect to n",
        "d": {
            description: "state link with data",
            data: {
                userId: 13,
                x: "Y",
            }
        },
        "rd": "Redirect to d with data",
        "rde": "Redirect to d with invalid data",
        "rde2": "Redirect to d with invalid data (circular structure)",
    };
    res.send("Hello!", links);
});

app.use("f", (req, res) => {
    let studentsListStr = "";
    for (const [i, st] of students.entries()) {
        studentsListStr += i + ". " + st + "\n";
    }
    const text = `Select student index:\n\n${studentsListStr}`;
    const indexForm = new InputForm("formaccept", {
        "index": "Index of student"
    });
    res.send(text, indexForm);
});

app.use("f2", (req, res) => {
    const text = 'Hello!';
    const form = new InputForm("formaccept", {
        "index": "Just",
        "name": "Student name",
        "score": "Hmmmm"
    });
    res.send(text, form);
});


app.use("f3", (req, res) => {
    const text = 'Hello!';
    const form = new InputForm("formaccept", {
        "id": {
            description: "Enter id",
            value: "1",
        },
        "index": "Just",
        "name": {
            description: "Enter student name",  
            default: "New Student",
        },
        "score": {
            description: "Enter score (int)",
            value: "100",
        }
    });
    res.send(text, form);
});

app.use("n", (req, res) => {
    res.send("Next, please");
});

app.use("r", (req, res) => {
    res.redirect("n");
});

app.use("t", (req, res) => {
    void res;  // unused
    // error: no response
});

app.use("rd", (req, res) => {
    res.redirect("d", {some: "Data in redirect"});
});

app.use("rde", (req, res) => {
    res.redirect("d", "Invalid data here");
});

app.use("rde2", (req, res) => {
    const co = {};
    co.self = co;
    res.redirect("d", co);
});

app.use("d", (req, res) => {
    res.send(`Got some data with request ${JSON.stringify(req.data)}`);
});

app.use("formaccept", (req, res) => {
    const index = parseInt(req.data.index);
    if ((!index && index !== 0) || (index < 0 || index >= students.length)) {
        res.send("Invalid student index input: " + req.data.index);
    } else {
        res.send(`Data:\n${JSON.stringify(req.data, null, 4)}\nYou've selected student: ${students[index]}`);
    }
});

app.listen(80);

//

const browser = new ConsoleBrowser();
browser.open(80);